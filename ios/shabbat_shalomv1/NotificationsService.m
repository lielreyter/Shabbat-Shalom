#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <UserNotifications/UserNotifications.h>

@interface NotificationsService : NSObject <RCTBridgeModule>
@end

@implementation NotificationsService

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

RCT_REMAP_METHOD(requestPermission,
                 requestPermissionWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    switch (settings.authorizationStatus) {
      case UNAuthorizationStatusAuthorized:
      case UNAuthorizationStatusProvisional:
      case UNAuthorizationStatusEphemeral:
        resolve(@(YES));
        return;
      case UNAuthorizationStatusDenied:
        resolve(@(NO));
        return;
      case UNAuthorizationStatusNotDetermined:
        break;
    }

    UNAuthorizationOptions options = UNAuthorizationOptionAlert | UNAuthorizationOptionBadge | UNAuthorizationOptionSound;
    [center requestAuthorizationWithOptions:options
                          completionHandler:^(BOOL granted, NSError * _Nullable error) {
      if (error != nil) {
        reject(@"notification_permission_failed",
               @"Failed to request notification permission.",
               error);
        return;
      }
      resolve(@(granted));
    }];
  }];
}

RCT_REMAP_METHOD(getPermissionStatus,
                 getPermissionStatusWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    switch (settings.authorizationStatus) {
      case UNAuthorizationStatusAuthorized:
      case UNAuthorizationStatusProvisional:
      case UNAuthorizationStatusEphemeral:
        resolve(@"authorized");
        return;
      case UNAuthorizationStatusDenied:
        resolve(@"denied");
        return;
      case UNAuthorizationStatusNotDetermined:
        resolve(@"notDetermined");
        return;
    }
  }];
}

RCT_REMAP_METHOD(scheduleNotification,
                 scheduleNotificationWithIdentifier:(NSString *)identifier
                 title:(NSString *)title
                 body:(NSString *)body
                 isoTime:(NSString *)isoTime
                 metadata:(NSDictionary *)metadata
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
  formatter.locale = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
  formatter.timeZone = [NSTimeZone timeZoneForSecondsFromGMT:0];
  formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ss.SSSXXXXX";

  NSDate *fireDate = [formatter dateFromString:isoTime];
  if (fireDate == nil) {
    formatter.dateFormat = @"yyyy-MM-dd'T'HH:mm:ssXXXXX";
    fireDate = [formatter dateFromString:isoTime];
  }

  if (fireDate == nil) {
    reject(@"notification_invalid_date",
           @"Notification time must be a valid ISO-8601 string.",
           nil);
    return;
  }

  if ([fireDate timeIntervalSinceNow] <= 0) {
    reject(@"notification_past_date",
           @"Notification time must be in the future.",
           nil);
    return;
  }

  UNMutableNotificationContent *content = [[UNMutableNotificationContent alloc] init];
  content.title = title;
  content.body = body;
  content.sound = UNNotificationSound.defaultSound;
  content.userInfo = metadata ?: @{};

  NSDateComponents *components =
      [[NSCalendar currentCalendar] components:(NSCalendarUnitYear |
                                                NSCalendarUnitMonth |
                                                NSCalendarUnitDay |
                                                NSCalendarUnitHour |
                                                NSCalendarUnitMinute |
                                                NSCalendarUnitSecond)
                                      fromDate:fireDate];
  UNCalendarNotificationTrigger *trigger =
      [UNCalendarNotificationTrigger triggerWithDateMatchingComponents:components repeats:NO];
  UNNotificationRequest *request =
      [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:trigger];

  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removePendingNotificationRequestsWithIdentifiers:@[ identifier ]];
  [center addNotificationRequest:request withCompletionHandler:^(NSError * _Nullable error) {
    if (error != nil) {
      reject(@"notification_schedule_failed",
             @"Failed to schedule local notification.",
             error);
      return;
    }
    resolve(nil);
  }];
}

RCT_REMAP_METHOD(cancelNotificationById,
                 cancelNotificationByIdWithIdentifier:(NSString *)identifier
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removePendingNotificationRequestsWithIdentifiers:@[ identifier ]];
  [center removeDeliveredNotificationsWithIdentifiers:@[ identifier ]];
  resolve(nil);
}

RCT_REMAP_METHOD(cancelAllNotifications,
                 cancelAllNotificationsWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
  [center removeAllPendingNotificationRequests];
  [center removeAllDeliveredNotifications];
  resolve(nil);
}

@end
