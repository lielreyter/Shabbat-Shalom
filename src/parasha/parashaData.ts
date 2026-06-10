export type ParashaInfo = {
  summary: string;
  book: string;
};

const parashaSummary = (...sentences: string[]): string => sentences.join(" ");

const PARASHA_MAP: Record<string, ParashaInfo> = {
  "Parashat Bereishit": {
    summary: parashaSummary(
      "Drawn from the public-domain JPS 1917 Torah, Bereishit begins with a world called into being by Divine speech: light, sky, earth, living creatures, and finally the human being formed in the image of God.",
      "The portion then moves from the peace of Eden to the pain of exile, from Cain and Abel to the first generations of humanity, teaching that creation is not only something God once did, but something He entrusts to us every day.",
      "The uplifting message is that even after failure, hiding, jealousy, and confusion, God continues to seek man, to clothe him, to guide him, and to leave open the path of return.",
      "Every week begins like Bereishit: the world is fresh again, our choices matter again, and a small act of goodness can bring more light into a place that yesterday felt dark."
    ),
    book: "Genesis",
  },
  "Parashat Noach": {
    summary: parashaSummary(
      "Noach tells of a generation that loses its moral center, yet one righteous man is asked to build an ark, preserve life, and carry hope through the storm.",
      "From the JPS 1917 Torah text we see the flood, the raven and dove, the fresh earth after the waters recede, and the rainbow covenant in which God promises that the world will endure.",
      "The portion is not only about judgment; it is about responsibility.",
      "Noah cannot fix his entire generation, but he can build the vessel God asks of him, gather what is precious, and keep life alive until a new beginning appears.",
      "That is a powerful lesson for our own week: when the world feels noisy or flooded, we build an ark of holiness around our time, our home, and our habits.",
      "One mitzvah, one prayer, one protected moment can become the safe place from which a cleaner world begins."
    ),
    book: "Genesis",
  },
  "Parashat Lech-Lecha": {
    summary: parashaSummary(
      "Lech-Lecha opens with God's call to Abram: go from your land, your birthplace, and your father's house to the land that I will show you.",
      "Based on the JPS 1917 Torah, the portion follows Abram and Sarai as they journey, face famine, separate from Lot, rescue captives, receive the covenant between the pieces, and are promised a future larger than anything they can yet see.",
      "The soul of the portion is movement.",
      "A person is not defined only by where he came from, by old patterns, or by familiar limitations.",
      "God tells Abram to walk, and in walking he discovers that his true identity is tied to mission.",
      "For us, Lech-Lecha means that spiritual growth often begins before everything is clear.",
      "We take one honest step away from what narrows us and one step toward what God is asking of us.",
      "The destination is shown through the journey, and each act of courage becomes part of a covenant that reaches beyond ourselves."
    ),
    book: "Genesis",
  },
  "Parashat Vayera": {
    summary: parashaSummary(
      "Vayera presents Abraham at his tent, welcoming strangers with warmth while recovering from his covenant, and those guests announce that Sarah will bear a son.",
      "The JPS 1917 Torah then carries us through Abraham's prayer for Sodom, the birth of Isaac, the pain of Hagar and Ishmael, and the binding of Isaac on Mount Moriah.",
      "Again and again, Abraham lives with open doors: open to guests, open to prayer, open to difficult obedience, and open to a future that seems impossible.",
      "The portion teaches that faith is not cold distance from the world; it is deep care, hospitality, moral pleading, and readiness to give ourselves to God.",
      "Sarah's laughter becomes Isaac's name, reminding us that Divine blessing can arrive where human calculation says it is too late.",
      "This week invites us to open one more door: to another person, to a prayer we had stopped saying, or to a promise we had almost given up believing."
    ),
    book: "Genesis",
  },
  "Parashat Chayei Sara": {
    summary: parashaSummary(
      "Chayei Sara begins with Sarah's passing, yet its name means the life of Sarah, because a righteous life continues through the values it plants in others.",
      "From the JPS 1917 Torah we read of Abraham purchasing the cave of Machpelah, creating a lasting bond with the land, and sending his servant to find a wife for Isaac.",
      "Rebecca appears at the well with kindness that is quick, generous, and practical: she gives water not only to the servant, but to the camels as well.",
      "That small scene reveals the future of the Jewish home.",
      "Holiness is not only thunder and miracles; it is a young woman seeing a need and moving with compassion.",
      "The portion lifts us by showing that continuity comes through faithful details: honoring the past, building a family, and recognizing greatness in acts no one forced us to do.",
      "This week, Sarah's life continues when we choose kindness with energy and create a home where blessing can rest."
    ),
    book: "Genesis",
  },
  "Parashat Toldot": {
    summary: parashaSummary(
      "Toldot follows Isaac and Rebecca as they pray for children and become parents to twins whose struggle begins before birth.",
      "The JPS 1917 Torah describes Esau the hunter and Jacob the quiet dweller in tents, the sale of the birthright, Isaac's wells, and the blessings that shape the destiny of the family.",
      "On the surface, the portion is full of tension, but beneath it is a deep teaching about identity.",
      "A blessing is not magic placed on a passive person; it calls forth the mission that was already waiting within the soul.",
      "Jacob must learn to carry spiritual responsibility into a complicated world, and Isaac's reopened wells remind us that the living waters dug by earlier generations can be uncovered again.",
      "This week asks us to look beneath our habits and ask what blessing we are meant to carry.",
      "Even when life feels conflicted, the well is still there, and with patience we can reveal its waters."
    ),
    book: "Genesis",
  },
  "Parashat Vayetzei": {
    summary: parashaSummary(
      "Vayetzei begins with Jacob leaving home alone and lying down in the open field, where he dreams of a ladder set on earth with its top reaching heaven.",
      "Based on the JPS 1917 Torah, the portion follows him to Haran, where he works for Rachel and Leah, builds a family, faces Laban's deception, and begins the formation of the tribes of Israel.",
      "The ladder is the key to the whole journey.",
      "Jacob discovers that heaven is not found only in protected places; even on the road, even in exile, even with stones for a pillow, God is present.",
      "Then he must bring that awareness into years of work, family complexity, and material struggle.",
      "The message is deeply encouraging: our ordinary labor can become a ladder when it is directed toward a holy purpose.",
      "This week, wherever we find ourselves, we can say with Jacob: God is in this place, and I can turn this place into a house of God."
    ),
    book: "Genesis",
  },
  "Parashat Vayishlach": {
    summary: parashaSummary(
      "Vayishlach brings Jacob back toward the land, but first he must face Esau, the brother he fears, and the unresolved past he carries.",
      "The JPS 1917 Torah tells of Jacob's gifts, prayer, preparation, his night-long struggle with a mysterious man, and the new name Israel, given because he has striven and prevailed.",
      "This portion speaks to anyone who has ever had to meet a difficult memory, a strained relationship, or an inner battle.",
      "Jacob does not become Israel by avoiding struggle; he becomes Israel by wrestling until dawn and refusing to let go without a blessing.",
      "The wound remains, but so does the new name.",
      "That is the hope of the parsha: even the places where we limp can become reminders that we encountered something holy and kept moving.",
      "This week invites us to face one hard thing with prayer, humility, and courage, trusting that dawn is closer than it seems."
    ),
    book: "Genesis",
  },
  "Parashat Vayeshev": {
    summary: parashaSummary(
      "Vayeshev begins with Joseph's dreams and quickly descends into jealousy, betrayal, and exile.",
      "From the JPS 1917 Torah, Joseph is loved by Jacob, hated by his brothers, cast into a pit, sold to Egypt, tested in Potiphar's house, and imprisoned after false accusation.",
      "Yet the portion quietly teaches that a dream rooted in holiness can survive every pit.",
      "Joseph's outer circumstances keep changing, but his inner loyalty does not.",
      "He brings integrity into a foreign home, moral strength into temptation, and faith into prison.",
      "The uplifting lesson is that descent is not the same as defeat.",
      "Sometimes the path to one's mission passes through places that appear to be interruptions, but God is weaving purpose even there.",
      "This week, if something feels delayed or unfair, Joseph teaches us to guard the dream, act with dignity where we are, and trust that the same God present in the light is present in the hidden preparation."
    ),
    book: "Genesis",
  },
  "Parashat Miketz": {
    summary: parashaSummary(
      "Miketz opens after Joseph has spent years forgotten in prison, until Pharaoh's dreams bring him suddenly before the throne.",
      "Based on the JPS 1917 Torah, Joseph interprets the seven years of plenty and famine, becomes ruler over Egypt, stores food for the future, and meets his brothers when they come seeking grain.",
      "The portion teaches that wisdom means seeing abundance as responsibility.",
      "Joseph does not use success for revenge or pride; he uses it to preserve life.",
      "The same man who was powerless in the pit now feeds nations, because he remained faithful when no one was watching.",
      "Miketz also reminds us that hidden family wounds can begin to heal through patience and truth.",
      "This week, the parsha calls us to prepare in times of plenty, share in times of need, and believe that a forgotten place can become the training ground for service.",
      "When God opens the door, the years of waiting reveal their purpose."
    ),
    book: "Genesis",
  },
  "Parashat Vayigash": {
    summary: parashaSummary(
      "Vayigash reaches one of the Torah's most emotional moments: Judah steps forward and offers himself in place of Benjamin.",
      "In the JPS 1917 Torah, that act of responsibility breaks open the hiddenness, and Joseph reveals himself to his brothers with tears, saying that God sent him ahead to preserve life.",
      "The portion is a shining lesson in teshuvah, because Judah is given a situation resembling the sale of Joseph and chooses differently.",
      "A person can grow.",
      "A family can heal.",
      "A wound can be reinterpreted without pretending it never hurt.",
      "Joseph's greatness is not only that he survives Egypt, but that he can see Divine purpose without becoming bitter.",
      "This week invites us to step forward where responsibility is needed, to choose differently from yesterday, and to make space for reconciliation.",
      "When one person says, let me carry the burden, the story can turn from exile toward reunion."
    ),
    book: "Genesis",
  },
  "Parashat Vayechi": {
    summary: parashaSummary(
      "Vayechi closes Genesis with Jacob living his final years in Egypt, blessing Joseph's sons and then blessing each of his own sons according to their path.",
      "The JPS 1917 Torah shows Jacob placing his hands on Ephraim and Manasseh, speaking to the tribes, asking to be buried in the land, and Joseph promising that God will surely remember His people.",
      "The portion is about endings that are really beginnings.",
      "Jacob's body is in Egypt, but his vision remains tied to the covenant and the future redemption.",
      "He sees each child not as a copy of the next, but as a distinct force in the people of Israel.",
      "This week teaches that blessing means helping someone recognize his mission.",
      "Even in exile, a Jewish family can live with its face toward redemption.",
      "Our task is to pass forward faith, name the good in those around us, and remember that God will surely bring us home."
    ),
    book: "Genesis",
  },
  "Parashat Shemot": {
    summary: parashaSummary(
      "Shemot begins the book of Exodus with the children of Israel multiplying in Egypt while a new Pharaoh turns fear into oppression.",
      "From the JPS 1917 Torah, we see slavery, the decree against the Hebrew boys, the courage of the midwives, Moses saved in a basket, and the burning bush where God calls him to redeem His people.",
      "The portion teaches that redemption begins with people who refuse to surrender their conscience.",
      "The midwives choose life, Pharaoh's daughter reaches beyond her palace, Moses turns aside to see the bush, and God hears the cry of the enslaved.",
      "No act of courage is too small to matter.",
      "Shemot lifts us by showing that the fire of holiness can burn inside a thornbush, in the lowliest place, without being consumed.",
      "This week, we are invited to notice the cry, protect life, and turn aside from routine long enough to hear what mission God is placing before us."
    ),
    book: "Exodus",
  },
  "Parashat Vaera": {
    summary: parashaSummary(
      "Vaera opens with God promising Moses that He has heard Israel's groaning and will bring them out with an outstretched arm.",
      "In the JPS 1917 Torah, Moses and Aaron stand before Pharaoh, the staff becomes a serpent, and the first seven plagues strike Egypt as Pharaoh repeatedly hardens his heart.",
      "The portion is not only a confrontation with a king; it is a revelation that no power can permanently imprison the Divine purpose.",
      "Pharaoh sees the world as control, labor, and domination.",
      "God reveals a deeper truth: creation itself answers to its Creator, and the oppressed are not forgotten.",
      "For us, Vaera is a message of strength.",
      "Some habits, fears, and systems do not fall in one moment, but each act of truth weakens the hold of Egypt.",
      "This week, we can hear God's promise personally: I will bring you out, I will deliver you, and I will take you to Me."
    ),
    book: "Exodus",
  },
  "Parashat Bo": {
    summary: parashaSummary(
      "Bo brings the final plagues upon Egypt and prepares Israel for the first Passover.",
      "Based on the JPS 1917 Torah, darkness covers the land, the firstborn plague breaks Pharaoh's resistance, and the Israelites mark their doors, eat the paschal offering, and leave Egypt in haste.",
      "This portion teaches that freedom is not merely escape from oppression; it is the birth of a people with memory, discipline, and sacred time.",
      "Before they walk out, Israel is given mitzvot: a calendar, a meal, a sign on the door, and words to tell their children.",
      "Redemption becomes something lived, remembered, and transmitted.",
      "The darkness of Egypt could be felt, yet in the dwellings of Israel there was light.",
      "This week, Bo asks us to make our homes places of light, to prepare for freedom with action, and to tell the next generation that God can take a person from midnight into morning."
    ),
    book: "Exodus",
  },
  "Parashat Beshalach": {
    summary: parashaSummary(
      "Beshalach follows Israel out of Egypt to the edge of the sea, with Pharaoh's army behind them and the waters before them.",
      "The JPS 1917 Torah tells of the splitting of the sea, the song of Moses and Israel, Miriam's song, the bitter waters made sweet, manna from heaven, and the battle with Amalek.",
      "The portion teaches that faith sometimes means walking forward before the path is visible.",
      "At the sea, the people learn that the obstacle itself can become the road when God commands them to move.",
      "In the wilderness, manna teaches daily trust: take what is needed for today, and receive tomorrow from God tomorrow.",
      "The uplift of Beshalach is that liberation continues after the miracle.",
      "We sing, we trust, we refine complaint into prayer, and we fight the coldness of Amalek with lifted hands.",
      "This week, take one step into the sea of your mission, and let trust make the bitter sweet."
    ),
    book: "Exodus",
  },
  "Parashat Yitro": {
    summary: parashaSummary(
      "Yitro brings Israel to Sinai, where the people hear the Ten Commandments amid thunder, lightning, cloud, and shofar.",
      "From the JPS 1917 Torah, the portion also tells of Jethro, Moses' father-in-law, who recognizes God's greatness and advises Moses to establish judges so the people can be guided with order and care.",
      "The revelation at Sinai teaches that the Infinite God desires a relationship with human life as it is actually lived: honoring parents, guarding speech, sanctifying time, rejecting theft, falsehood, and envy.",
      "The highest spirituality enters the simplest obligations.",
      "Yitro himself reminds us that truth can be recognized by someone who comes from outside and listens with humility.",
      "This week, the mountain stands before us again.",
      "Every mitzvah is a fresh echo of Sinai, and every ordinary decision can become a place where heaven touches earth."
    ),
    book: "Exodus",
  },
  "Parashat Mishpatim": {
    summary: parashaSummary(
      "Mishpatim follows the thunder of Sinai with laws about servants, damages, lending, justice, festivals, and compassion for the stranger, widow, and orphan.",
      "Based on the JPS 1917 Torah, the portion shows that revelation is not meant to remain above life; it must shape courts, business, speech, property, and the way we treat vulnerable people.",
      "The people respond with the timeless words, we will do and we will hear.",
      "That order is powerful.",
      "A Jew does not wait to understand every depth before acting; action opens the heart to understanding.",
      "Mishpatim is uplifting because it insists that holiness can live in details that look ordinary.",
      "Paying fairly, returning what is lost, refusing a false report, and helping another person's animal are all ways of making God's will visible.",
      "This week, the parsha asks us to turn inspiration into conduct and to make justice itself a form of worship."
    ),
    book: "Exodus",
  },
  "Parashat Terumah": {
    summary: parashaSummary(
      "Terumah begins with God's invitation: let them take for Me an offering, from every person whose heart moves him.",
      "The JPS 1917 Torah describes the gifts of gold, silver, copper, wool, skins, oil, spices, and stones, and then the vessels of the Tabernacle: the Ark, Table, Menorah, curtains, boards, and altar.",
      "The central promise is astonishing: they shall make Me a sanctuary, and I will dwell among them.",
      "God does not say only in it, but among them, teaching that the true sanctuary is built in the hearts and lives of the people.",
      "Terumah lifts us by showing that holiness is made from what we willingly give.",
      "Material things become sacred when offered with purpose.",
      "This week, we can ask: what gold, what talent, what time, what attention can I contribute?",
      "When the heart gives, even the ordinary materials of life become a dwelling place for the Divine Presence."
    ),
    book: "Exodus",
  },
  "Parashat Tetzaveh": {
    summary: parashaSummary(
      "Tetzaveh opens with the command to bring pure olive oil for the lamp, to cause a light to burn continually.",
      "From the JPS 1917 Torah, the portion gives the garments of Aaron and his sons, the breastplate with the names of the tribes, the consecration offerings, the daily service, and the golden altar of incense.",
      "The Torah devotes great care to garments because the way we present ourselves in service matters.",
      "The priest carries the names of Israel on his heart, teaching that spiritual leadership means bearing others with love before God.",
      "The steady light of the Menorah is also a picture of the soul: sometimes small, sometimes surrounded by darkness, but meant to be kindled with pure oil.",
      "This week, Tetzaveh invites us to tend the flame.",
      "A consistent mitzvah, a sincere prayer, and a heart that carries another person's name can make our service beautiful before God."
    ),
    book: "Exodus",
  },
  "Parashat Ki Tisa": {
    summary: parashaSummary(
      "Ki Tisa contains both deep failure and deeper mercy.",
      "The JPS 1917 Torah tells of the census, the basin, the anointing oil, Shabbat, the giving of the tablets, the sin of the golden calf, Moses' prayers, the second tablets, and the revelation of God's attributes of compassion.",
      "When Moses descends and sees the calf, the tablets are broken, but the covenant is not finished.",
      "That is the hope at the heart of the portion.",
      "A broken moment can become the beginning of teshuvah when there is honesty, prayer, and renewed commitment.",
      "God teaches Moses that mercy is not weakness; it is the Divine power that allows human beings to return.",
      "Ki Tisa also places Shabbat near the work of the sanctuary, reminding us that holiness requires both building and stopping.",
      "This week, if something has been broken, do not worship the break.",
      "Bring it to God, ask for mercy, and begin carving the second tablets."
    ),
    book: "Exodus",
  },
  "Parashat Vayakhel": {
    summary: parashaSummary(
      "Vayakhel begins with Moses gathering the whole community and placing Shabbat before the work of building the Tabernacle.",
      "Based on the JPS 1917 Torah, men and women whose hearts are moved bring materials, and skilled artisans led by Bezalel and Oholiab make the curtains, vessels, boards, and sacred furnishings.",
      "The people give so generously that Moses must tell them to stop bringing.",
      "This portion is a beautiful correction after the golden calf.",
      "The same capacity to give, create, and unite that was misdirected can now be lifted into holiness.",
      "Vayakhel teaches that community is built when each person contributes what only he or she can give.",
      "Some bring gold, some spin thread, some craft, some carry, and together they make a dwelling for God.",
      "This week, ask not only what you need from the community, but what gift your heart is moved to bring."
    ),
    book: "Exodus",
  },
  "Parashat Pekudei": {
    summary: parashaSummary(
      "Pekudei gives the accounting of the Tabernacle, showing how the donated materials were used and how every detail was completed as God commanded Moses.",
      "The JPS 1917 Torah describes the priestly garments, the assembly of the sanctuary, Moses' blessing, and finally the cloud of God's glory filling the Tabernacle.",
      "This portion teaches that inspiration becomes lasting only when it is brought into accountability, precision, and completion.",
      "The people gave with open hearts, but the Torah also records the count, because holiness is not opposed to responsibility.",
      "When the work is finished, the Divine Presence rests, and the cloud guides Israel by day and fire by night.",
      "Pekudei is uplifting because it shows that faithful details invite visible blessing.",
      "This week, complete one holy task you began.",
      "Put the final hook in place, make the honest accounting, and trust that when we prepare a place for God, He guides the next journey."
    ),
    book: "Exodus",
  },
  "Parashat Vayakhel-Pekudei": {
    summary: parashaSummary(
      "Vayakhel-Pekudei gathers the community to build the Tabernacle and then accounts for the work until the sanctuary is complete.",
      "From the JPS 1917 Torah, the people bring generous gifts, artisans shape each vessel and curtain, Moses reviews the work, blesses the people, and the glory of God fills the dwelling.",
      "Together these portions show a complete path of repair.",
      "After the golden calf, Israel does not remain trapped in failure; the people redirect their energy into generosity, craftsmanship, Shabbat, and shared purpose.",
      "The lesson is profoundly hopeful: the same hands that once contributed to confusion can now build a home for the Divine Presence.",
      "Holiness needs both a moved heart and a careful accounting.",
      "This week, bring your gift, respect the details, and help make your surroundings into a sanctuary.",
      "When a community builds for God, the cloud of guidance returns."
    ),
    book: "Exodus",
  },
  "Parashat Vayikra": {
    summary: parashaSummary(
      "Vayikra begins with a call to Moses from the Tent of Meeting, a quiet word of closeness before the laws of offerings are taught.",
      "Based on the JPS 1917 Torah, the portion describes burnt offerings, meal offerings, peace offerings, sin offerings, and guilt offerings, each bringing a person, a family, or the community closer to God.",
      "The Hebrew idea of an offering is not merely sacrifice, but drawing near.",
      "A person takes something from the physical world - an animal, flour, oil, frankincense - and lifts it into relationship with the Divine.",
      "Vayikra teaches that mistakes do not have to create distance forever.",
      "There is a path back, and even the smallest offering of flour can be precious when brought with sincerity.",
      "This week, listen for the gentle call beneath the noise.",
      "Bring one part of ordinary life closer to God, and let closeness become the measure of the day."
    ),
    book: "Leviticus",
  },
  "Parashat Tzav": {
    summary: parashaSummary(
      "Tzav continues the laws of the offerings and speaks especially to Aaron and his sons about the priestly service.",
      "The JPS 1917 Torah describes the fire kept burning on the altar, the procedures for offerings, the portions eaten by the priests, and the seven days of consecration at the entrance of the Tent of Meeting.",
      "The constant fire is the heart of the portion.",
      "It teaches that inspiration must be tended daily.",
      "A flame left alone can weaken, but a flame cared for each morning becomes the center of the sanctuary.",
      "Tzav also shows that service is not only emotion; it has discipline, order, garments, time, and responsibility.",
      "This is uplifting because it means holiness is reachable through consistency.",
      "This week, keep one fire burning: a prayer at a set time, a daily act of kindness, a protected moment of learning.",
      "Small steady flames warm the whole soul."
    ),
    book: "Leviticus",
  },
  "Parashat Shmini": {
    summary: parashaSummary(
      "Shmini opens on the eighth day, when the Tabernacle service begins and fire from before God consumes the offering before the eyes of the people.",
      "From the JPS 1917 Torah, the portion also tells of the tragic death of Nadav and Avihu after bringing strange fire, Aaron's silent response, and the laws of permitted and forbidden animals.",
      "The portion holds joy and awe together.",
      "Closeness to God is real, powerful, and beautiful, but it asks for humility and obedience rather than self-invented spiritual drama.",
      "Aaron's silence is not emptiness; it is a deep surrender in a moment beyond words.",
      "The dietary laws then bring holiness into eating, teaching that the body too participates in a sacred life.",
      "This week, Shmini invites us to seek fiery inspiration while grounding it in mitzvah.",
      "Let enthusiasm rise, but let it be shaped by what God asks, so the flame becomes light."
    ),
    book: "Leviticus",
  },
  "Parashat Tazria": {
    summary: parashaSummary(
      "Tazria begins with the holiness surrounding birth and then turns to the laws of tzaraat, the spiritual condition that appears on skin, garments, or later homes.",
      "Based on the JPS 1917 Torah, the priest examines, waits, reexamines, and determines the path toward purity.",
      "This portion can feel distant, yet its inner message is tender and relevant.",
      "Not every mark defines a person forever.",
      "The Torah requires careful looking, patience, and the involvement of a spiritual guide before judgment is made.",
      "The person is separated not to be discarded, but to begin a process of healing and return.",
      "Tazria teaches us to take speech, boundaries, and inner health seriously.",
      "It also teaches hope: what appears on the surface can be addressed at the root.",
      "This week, notice what needs healing without shame, seek wise guidance, and believe that purity is not a lost state but a path back."
    ),
    book: "Leviticus",
  },
  "Parashat Metzora": {
    summary: parashaSummary(
      "Metzora describes the return of one who has been healed from tzaraat.",
      "The JPS 1917 Torah gives a detailed process with birds, cedar wood, scarlet, hyssop, washing, offerings, and gradual reentry into the camp.",
      "The portion also discusses marks on houses, showing that spiritual repair can touch not only the individual but the environment in which he lives.",
      "Metzora is a parsha of restoration.",
      "After isolation comes return; after examination comes cleansing; after silence comes reintegration.",
      "The ritual uses both a lofty cedar and a lowly hyssop, reminding us that healing needs dignity and humility together.",
      "This is an uplifting message for anyone who has felt outside the camp.",
      "The Torah does not leave a person in distance.",
      "It gives steps, time, and offerings that say: you can come back.",
      "This week, take one concrete step toward repaired speech, repaired relationships, and a more peaceful home."
    ),
    book: "Leviticus",
  },
  "Parashat Tazria-Metzora": {
    summary: parashaSummary(
      "Tazria-Metzora brings together the appearance of tzaraat and the path of purification after it heals.",
      "Based on the JPS 1917 Torah, the priest examines marks on the body, garments, and homes, waits before declaring a status, and guides the person through offerings, washing, and return to the camp.",
      "These portions teach that spiritual life includes diagnosis and restoration.",
      "A mark is not ignored, but neither is a person reduced to it.",
      "The Torah creates a process filled with care, patience, humility, and hope.",
      "The movement from isolation back into community reminds us that the goal of correction is reconnection.",
      "This week, the parsha asks us to look honestly at the places where speech, pride, or habit have left a stain, and then to believe in repair.",
      "With humility like hyssop and strength like cedar, a person can return cleaner, kinder, and closer to God."
    ),
    book: "Leviticus",
  },
  "Parashat Achrei Mot": {
    summary: parashaSummary(
      "Achrei Mot begins after the death of Aaron's two sons and gives the service for the holiest day, when the High Priest enters the Holy of Holies.",
      "From the JPS 1917 Torah, we read of offerings, confession, the sending away of the scapegoat, and the command to afflict the soul on Yom Kippur, followed by laws that protect the sanctity of life and relationships.",
      "The portion teaches that closeness to God needs preparation, humility, and boundaries.",
      "The High Priest enters not whenever he wishes, but as God commands.",
      "Yet the purpose of all this awe is cleansing and renewal.",
      "Israel is given a day when sin does not have the final word.",
      "This week, Achrei Mot invites us to enter our own inner sanctuary carefully.",
      "Confess what needs changing, release what must be sent away, and remember that God makes room for a purified beginning."
    ),
    book: "Leviticus",
  },
  "Parashat Kedoshim": {
    summary: parashaSummary(
      "Kedoshim opens with the great call: be holy, for I the Lord your God am holy.",
      "Based on the JPS 1917 Torah, the portion gathers mitzvot about parents, Shabbat, charity, honest judgment, wages, gossip, revenge, love of neighbor, respect for the elderly, and fairness to the stranger.",
      "The striking message is that holiness is not escape from the world.",
      "It is how we harvest a field, pay a worker, speak about another person, honor age, and conduct business.",
      "The command to love your neighbor as yourself stands among practical laws, teaching that love becomes real through action.",
      "Kedoshim is uplifting because it places Divine holiness within reach of daily life.",
      "Every interaction can reflect the Holy One.",
      "This week, choose one ordinary place to become holy: your phone, your money, your speech, your patience.",
      "Holiness grows when God's greatness is made visible through human decency."
    ),
    book: "Leviticus",
  },
  "Parashat Achrei Mot-Kedoshim": {
    summary: parashaSummary(
      "Achrei Mot-Kedoshim joins the awe of Yom Kippur with the practical holiness of everyday conduct.",
      "The JPS 1917 Torah first describes the High Priest entering the Holy of Holies with offerings, confession, and purification, then turns to the command to be holy through justice, charity, truthful speech, family sanctity, and love of neighbor.",
      "Together the portions teach a complete spiritual life.",
      "We need moments of deep inward cleansing, but we also need that purity to show up in how we treat people.",
      "The holiest place and the marketplace are not separate worlds.",
      "A person who seeks forgiveness must also leave the corners of his field for the poor and refuse gossip or revenge.",
      "This week, enter the inner room of the soul, then bring its light outward.",
      "Let repentance become kindness, and let holiness become visible in the next conversation."
    ),
    book: "Leviticus",
  },
  "Parashat Emor": {
    summary: parashaSummary(
      "Emor speaks to the priests about the dignity of their service and then lays out the sacred calendar of Shabbat and the festivals.",
      "From the JPS 1917 Torah, we encounter laws of priestly holiness, offerings without blemish, the Sabbath, Passover, the Omer, Shavuot, Rosh Hashanah, Yom Kippur, Sukkot, the Menorah, and the showbread.",
      "The portion teaches that holiness lives in both people and time.",
      "The priest must guard the honor of his calling, and Israel must learn to meet God through appointed days.",
      "Time is not empty; it can be sanctified.",
      "The festivals carry us through freedom, harvest, awe, forgiveness, and joy, shaping the year into a journey with God.",
      "Emor uplifts us by reminding us that the calendar itself can become a teacher.",
      "This week, honor your calling and guard your time.",
      "A protected hour, a Shabbat table, or a remembered festival can turn passing days into holy appointments."
    ),
    book: "Leviticus",
  },
  "Parashat Behar": {
    summary: parashaSummary(
      "Behar is taught at Mount Sinai and gives the laws of the Sabbatical year and Jubilee.",
      "Based on the JPS 1917 Torah, the land rests every seventh year, debts and ownership are reframed, servants are released, and families are given the possibility of return.",
      "The portion's message is radical trust.",
      "The land is not ultimately ours, wealth is not ultimate, and no person should be trapped forever by yesterday's poverty or loss.",
      "God promises blessing when Israel allows the land to rest, teaching that livelihood is not produced by anxiety alone.",
      "Behar is deeply uplifting because it says that life has built-in restoration.",
      "There is a year to stop, a year to release, a year to come home.",
      "This week, practice a small Shmita: release one grip, make room for trust, and remember that you are not owned by pressure.",
      "You belong to God, and from that belonging comes freedom."
    ),
    book: "Leviticus",
  },
  "Parashat Bechukotai": {
    summary: parashaSummary(
      "Bechukotai closes Leviticus with blessings for walking in God's statutes and warnings about the pain that follows spiritual abandonment.",
      "The JPS 1917 Torah speaks of rain in its season, fruitful land, peace, security, and God's presence among Israel, but also of exile and suffering if the covenant is rejected.",
      "Yet even in the warnings, the deepest note is hope.",
      "God says He will remember the covenant with Jacob, Isaac, and Abraham, and He will not utterly reject His people.",
      "The portion teaches that our choices matter, but God's bond with Israel is deeper than our failures.",
      "Walking with God brings harmony into the world: earth, food, peace, courage, and dwelling with the Divine.",
      "This week, Bechukotai invites us to walk, not merely believe while standing still.",
      "Take one mitzvah as a step, and let the covenant become a path under your feet."
    ),
    book: "Leviticus",
  },
  "Parashat Behar-Bechukotai": {
    summary: parashaSummary(
      "Behar-Bechukotai joins the laws of release with the covenant of blessing and responsibility.",
      "From the JPS 1917 Torah, the land rests in the Sabbatical year, families return in the Jubilee, servants are treated with dignity, and Israel is promised rain, fruitfulness, peace, and God's presence when they walk in His ways.",
      "The portions also warn of exile, yet end with the assurance that God remembers His covenant and does not abandon His people.",
      "Together they teach that freedom and faithfulness belong together.",
      "A society becomes holy when land, labor, money, and time all acknowledge that God is the true owner.",
      "This week, the combined message is hopeful and practical: release what should not own you, walk in the mitzvot that give life direction, and trust that covenant is stronger than collapse.",
      "Even after distance, the road back remains open."
    ),
    book: "Leviticus",
  },
  "Parashat Bamidbar": {
    summary: parashaSummary(
      "Bamidbar opens in the wilderness of Sinai with a census of the tribes and the arrangement of the camp around the Tabernacle.",
      "Based on the JPS 1917 Torah, every tribe is counted by its family, its house, and its banner, while the Levites are appointed to guard and carry the sanctuary.",
      "The wilderness can seem like a place of emptiness, but the Torah turns it into a place of order, identity, and Divine closeness.",
      "Each person counts, each tribe has a place, and the center of the camp is not power or wealth, but the dwelling of God.",
      "Bamidbar is uplifting because it says that even in a desert, no soul is anonymous.",
      "You have a name, a banner, a family story, and a position from which to serve.",
      "This week, organize your life around the center.",
      "When God is in the middle, even wilderness becomes a camp of purpose."
    ),
    book: "Numbers",
  },
  "Parashat Nasso": {
    summary: parashaSummary(
      "Nasso continues the ordering of the camp, assigning the Levite families their sacred tasks and teaching laws that protect purity, trust, and dedication.",
      "The JPS 1917 Torah includes the Nazirite vow, the offerings of the tribal leaders, and the priestly blessing: may the Lord bless you and keep you, shine His face upon you, and give you peace.",
      "The portion is the longest in the Torah, yet its heart is very simple: every person and every family has a way to carry holiness.",
      "Some carry curtains, some carry vessels, some bring offerings, some accept extra discipline for a time.",
      "The priestly blessing reminds us that the highest gift is not only success, but a shining Divine face and peace.",
      "This week, receive that blessing personally and become a channel of it to someone else.",
      "Carry your assignment with dignity, and let your presence add peace to the camp."
    ),
    book: "Numbers",
  },
  "Parashat Beha'alotcha": {
    summary: parashaSummary(
      "Beha'alotcha begins with Aaron kindling the Menorah, lifting the flames so they shine toward the center.",
      "From the JPS 1917 Torah, the Levites are consecrated, the second Passover is given for those who missed the first, the cloud guides Israel's journeys, and the people struggle with complaint as they travel from Sinai.",
      "The portion teaches that a Jew's task is to light souls, including his own, until the flame rises by itself.",
      "It also offers extraordinary hope through Pesach Sheni: if someone was distant or unable the first time, God opens another door.",
      "Spiritual opportunity is not closed forever.",
      "The cloud and trumpets show that journeys require guidance, signals, and trust.",
      "This week, lift one flame and accept one second chance.",
      "Instead of letting complaint define the road, let the light of the Menorah show the next step forward."
    ),
    book: "Numbers",
  },
  "Parashat Sh'lach": {
    summary: parashaSummary(
      "Sh'lach tells of the spies sent to scout the Land of Israel.",
      "Based on the JPS 1917 Torah, they see a land flowing with fruit, but ten spies return with fear, causing the people to weep and resist entering the land, while Caleb and Joshua insist that with God's help they can go up and possess it.",
      "The portion reveals how vision can be distorted by fear.",
      "The spies report facts, but they interpret them through a small view of themselves and of God.",
      "Caleb and Joshua see the same giants and the same land, yet they remember the promise.",
      "Sh'lach is uplifting because it teaches that faith changes how we read reality.",
      "The portion ends with tzitzit, fringes that help us remember God's commandments and not wander after the eyes alone.",
      "This week, look again at the challenge before you.",
      "Do not deny the giants, but do not forget Who walks with you."
    ),
    book: "Numbers",
  },
  "Parashat Korach": {
    summary: parashaSummary(
      "Korach rises against Moses and Aaron, claiming that the entire congregation is holy and questioning their leadership.",
      "The JPS 1917 Torah recounts the rebellion, the earth opening beneath the rebels, the fire pans, the plague, and Aaron's staff blossoming with almonds as a sign of chosen service.",
      "The portion warns that holy language can be used for unholy ego.",
      "Korach speaks about equality, but his movement is driven by jealousy and refusal to accept the role God assigned him.",
      "Aaron's staff teaches a different kind of greatness: true leadership blossoms, gives life, and brings peace.",
      "The message for the week is not to suppress ambition, but to refine it.",
      "Ask whether your desire is to serve or to win.",
      "When we accept our mission with humility, even a dry staff can flower, and what looked lifeless can become a sign of Divine choice."
    ),
    book: "Numbers",
  },
  "Parashat Chukat": {
    summary: parashaSummary(
      "Chukat begins with the mystery of the red heifer, whose ashes purify from contact with death.",
      "From the JPS 1917 Torah, the portion then moves through the deaths of Miriam and Aaron, the people's thirst, Moses striking the rock, journeys around hostile nations, and healing through the copper serpent.",
      "This is a portion about faith when life feels beyond understanding.",
      "The red heifer is called a statute, reminding us that not every Divine command can be reduced to human logic.",
      "Miriam's well disappears, the people thirst, and Moses' pain at the rock shows how even great leaders are tested.",
      "Yet water still comes, healing is still offered, and the journey continues.",
      "Chukat uplifts us by teaching that holiness can meet us in mystery, grief, and repair.",
      "This week, when you cannot explain everything, keep walking with God.",
      "Speak to the rock before striking, and look upward for healing."
    ),
    book: "Numbers",
  },
  "Parashat Balak": {
    summary: parashaSummary(
      "Balak, king of Moab, fears Israel and hires Balaam to curse them.",
      "Based on the JPS 1917 Torah, Balaam sets out, his donkey sees the angel he does not see, and when he finally stands over the camp, God turns his intended curses into blessings, including the words: how goodly are thy tents, O Jacob.",
      "The portion teaches that no outside voice can define Israel against God's will.",
      "Balaam has talent without humility, vision without surrender, and speech that must be forced into blessing.",
      "Israel's strength, meanwhile, is seen in the modest beauty of its tents and the order of its camp.",
      "Balak is uplifting because it reveals hidden protection.",
      "Even when we do not know who is speaking against us, God can transform the energy into blessing.",
      "This week, guard the holiness of your tent, your home, and your words.",
      "A life arranged with modesty and purpose becomes its own blessing."
    ),
    book: "Numbers",
  },
  "Parashat Chukat-Balak": {
    summary: parashaSummary(
      "Chukat-Balak joins mystery, journey, loss, and unexpected blessing.",
      "From the JPS 1917 Torah, Israel receives the law of the red heifer, mourns Miriam and Aaron, thirsts for water, sees Moses strike the rock, and continues through the wilderness; then Balak hires Balaam to curse Israel, only for God to place blessings in his mouth.",
      "Together the portions teach that God guides both the inner struggle and the outer threat.",
      "Within the camp there is thirst, grief, and the need for healing; outside the camp there are enemies and curses.",
      "Yet water comes, healing is offered, and curses become the praise of Israel's tents.",
      "This week, do not be discouraged by mystery or opposition.",
      "Refine what is inside your tent, trust God's protection from what is outside it, and remember that even a hard road can carry hidden blessings."
    ),
    book: "Numbers",
  },
  "Parashat Pinchas": {
    summary: parashaSummary(
      "Pinchas opens with God granting Pinchas a covenant of peace after his zealous act stops a plague.",
      "The JPS 1917 Torah then records a new census, the daughters of Zelophehad courageously asking for an inheritance in the land, Moses seeing the land from afar, Joshua being appointed, and the daily and festival offerings.",
      "The portion holds zeal and peace together, teaching that passion for God must ultimately serve life, covenant, and continuity.",
      "The daughters of Zelophehad bring another uplifting lesson: holy desire can speak respectfully and still change the law's application.",
      "They love the land and refuse to let their father's name disappear.",
      "Moses, the greatest leader, asks God to appoint a shepherd who will care for the people after him.",
      "This week, Pinchas invites us to direct passion toward peace, to speak up for a holy inheritance, and to build continuity beyond ourselves."
    ),
    book: "Numbers",
  },
  "Parashat Matot": {
    summary: parashaSummary(
      "Matot begins with the laws of vows, teaching the weight and holiness of spoken words.",
      "Based on the JPS 1917 Torah, the portion also tells of the war against Midian, the purification of vessels, the distribution of spoils, and the request of Reuben, Gad, and half of Manasseh to settle east of the Jordan.",
      "Moses challenges those tribes not to abandon their brothers, and they commit to leading the people into battle before returning to their homes.",
      "The portion teaches that speech creates obligation.",
      "A promise is not a sound that disappears; it becomes a bond in the world.",
      "Matot also teaches that personal comfort must not come before communal responsibility.",
      "If we ask for our place, we must also help others reach theirs.",
      "This week, choose words carefully, keep one commitment fully, and make sure that the blessings you seek for yourself do not separate you from the needs of the people."
    ),
    book: "Numbers",
  },
  "Parashat Masei": {
    summary: parashaSummary(
      "Masei recounts the journeys of Israel from Egypt through the wilderness to the plains of Moab.",
      "From the JPS 1917 Torah, each station is named, the borders of the land are defined, leaders are appointed for inheritance, Levitical cities are assigned, and cities of refuge are established for one who caused death unintentionally.",
      "The list of journeys teaches that no step is wasted.",
      "Places of fear, thirst, failure, and growth all become part of the sacred record when they lead toward the promised land.",
      "The cities of refuge add a message of mercy and responsibility: even when harm was not intended, life is precious and repair requires structure.",
      "Masei uplifts us by transforming the map of the past into a testimony of guidance.",
      "This week, look back without despair.",
      "Every station can become part of your journey toward holiness if you keep moving, learn from it, and make room for refuge and return."
    ),
    book: "Numbers",
  },
  "Parashat Matot-Masei": {
    summary: parashaSummary(
      "Matot-Masei closes Numbers by joining the holiness of speech with the holiness of the journey.",
      "Based on the JPS 1917 Torah, vows are treated as binding, the eastern tribes promise to help their brothers before settling, Israel's wilderness stations are recorded, the borders of the land are described, and cities of refuge are established.",
      "Together these portions teach that a sacred life needs both commitment and movement.",
      "Our words must be trustworthy, and our travels must be understood as part of Divine guidance.",
      "The tribes east of the Jordan learn that personal blessing cannot be separated from responsibility for the whole people.",
      "The journeys teach that even difficult stops can become holy when they are part of going forward.",
      "This week, honor your word, help someone else reach their portion, and view your own road with more faith.",
      "God can turn every station into preparation."
    ),
    book: "Numbers",
  },
  "Parashat Devarim": {
    summary: parashaSummary(
      "Devarim begins Moses' final address to Israel as they stand near the land after forty years in the wilderness.",
      "From the JPS 1917 Torah, Moses reviews the appointment of judges, the sin of the spies, the years of wandering, and the victories over Sihon and Og.",
      "His words are not nostalgia; they are loving preparation.",
      "Before entering a new stage, Israel must learn how to remember.",
      "Moses speaks of failures not to shame the people, but to help them enter the future with humility, courage, and clarity.",
      "The portion teaches that rebuke, when it comes from love and truth, can be a gift.",
      "It helps a person stop repeating the same desert.",
      "This week, Devarim invites us to review our own journey honestly.",
      "Name what went wrong, notice where God still carried you, and step toward the next chapter wiser, stronger, and ready to enter the land."
    ),
    book: "Deuteronomy",
  },
  "Parashat Vaetchanan": {
    summary: parashaSummary(
      "Vaetchanan opens with Moses pleading to enter the land, but God tells him to ascend and see it from afar.",
      "The JPS 1917 Torah then gives powerful warnings against idolatry, recalls Sinai, repeats the Ten Commandments, and teaches the Shema: Hear, O Israel, the Lord our God, the Lord is One.",
      "Moses does not receive everything he wants, yet he uses his remaining strength to teach the people how to live.",
      "That is greatness: turning personal disappointment into service.",
      "The Shema becomes the center of Jewish faith, calling us to love God with heart, soul, and might, and to place His words in our homes, on our hands, and before our eyes.",
      "This week, Vaetchanan invites us to transform longing into love.",
      "Even when a door stays closed, the soul can still declare God's oneness and fill the next action with devotion."
    ),
    book: "Deuteronomy",
  },
  "Parashat Eikev": {
    summary: parashaSummary(
      "Eikev teaches Israel to remember God especially when life becomes good.",
      "Based on the JPS 1917 Torah, Moses speaks of blessing for keeping the commandments, the manna in the wilderness, the good land of wheat, barley, vines, figs, pomegranates, olives, and honey, and the danger of saying my power made this wealth.",
      "The portion's uplift is gratitude.",
      "Moses reminds Israel that hunger, manna, clothing that did not wear out, and the long road were all forms of education: man does not live by bread alone, but by what comes from the mouth of God.",
      "Prosperity is holy when it leads to blessing God, humility, and generosity.",
      "This week, Eikev asks us to notice the small heels of life, the quiet details we step on and overlook.",
      "Say thank you, remember the Source, and let success make you softer, not prouder."
    ),
    book: "Deuteronomy",
  },
  "Parashat Re'eh": {
    summary: parashaSummary(
      "Re'eh begins with a clear invitation: see, I set before you this day a blessing and a curse.",
      "From the JPS 1917 Torah, Moses teaches about worship in the place God will choose, rejecting idolatry, kosher animals, tithes, release of debts, generosity to the poor, and the pilgrimage festivals.",
      "The portion emphasizes sight because spiritual life depends on how we choose to see.",
      "A mitzvah is not only a restriction; it is a path of blessing.",
      "Charity is not only a loss; it opens the hand and heart.",
      "Festivals are not interruptions; they gather us into joy before God.",
      "Re'eh is uplifting because it places choice back in our hands.",
      "Every day sets blessing before us in concrete form: what we eat, where we give, how we celebrate, what we refuse to worship.",
      "This week, look again.",
      "Choose one visible act of blessing, and let it train the eyes of the soul."
    ),
    book: "Deuteronomy",
  },
  "Parashat Shoftim": {
    summary: parashaSummary(
      "Shoftim commands Israel to appoint judges and officers and gives the famous charge: justice, justice shalt thou pursue.",
      "Based on the JPS 1917 Torah, the portion discusses courts, witnesses, kings, priests, prophets, cities of refuge, boundaries, warfare, and the unsolved murder ceremony.",
      "Its message is that holiness must shape public life, not only private feeling.",
      "A society close to God needs honest judgment, humble leadership, truthful prophecy, respect for life, and restraint even in conflict.",
      "The repetition of justice teaches persistence: pursue it in judgment and in compromise, in law and in daily conduct.",
      "Shoftim is uplifting because it trusts that the world can be ordered toward righteousness.",
      "This week, appoint inner judges at your own gates: what enters your eyes, ears, mouth, and home?",
      "Pursue what is right twice - once in principle and once in action."
    ),
    book: "Deuteronomy",
  },
  "Parashat Ki Teitzei": {
    summary: parashaSummary(
      "Ki Teitzei contains many mitzvot touching family, work, property, animals, speech, business, and memory.",
      "From the JPS 1917 Torah, we encounter laws about returning lost objects, helping an animal under its burden, guarding a roof, honest weights, paying workers on time, protecting dignity, and remembering Amalek.",
      "The portion's beauty is its attention to daily life.",
      "The Torah does not wait for grand moments to ask for holiness.",
      "It enters the field, the marketplace, the home, the road, and the relationship between employer and worker.",
      "Even a bird's nest and a roof railing matter, because compassion and responsibility are never small before God.",
      "Ki Teitzei uplifts us by showing that every detail can become a mitzvah opportunity.",
      "This week, do one small right thing immediately: return, protect, pay, help, remember.",
      "The road to holiness is paved with faithful details."
    ),
    book: "Deuteronomy",
  },
  "Parashat Ki Tavo": {
    summary: parashaSummary(
      "Ki Tavo begins with the first fruits brought to the place God will choose.",
      "Based on the JPS 1917 Torah, the farmer declares the story from Jacob's wandering to Egypt, affliction, redemption, and the gift of the land, then rejoices with the Levite and stranger.",
      "The portion later describes blessings and warnings pronounced between Mount Gerizim and Mount Ebal.",
      "Its opening teaches the soul of gratitude.",
      "When a person holds fruit in his hands, he does not say only, look what I grew.",
      "He tells the story of God's kindness across generations.",
      "Ki Tavo reminds us that gratitude turns possession into offering and success into humility.",
      "The blessings and warnings show that covenant is serious, but the first fruits show that its heart is joy.",
      "This week, bring your first and best to God.",
      "Name the journey behind your blessings, and let thanks become action."
    ),
    book: "Deuteronomy",
  },
  "Parashat Nitzavim": {
    summary: parashaSummary(
      "Nitzavim gathers all Israel before God: leaders, elders, children, women, strangers, woodcutters, and water drawers.",
      "The JPS 1917 Torah renews the covenant and teaches that after return, God will gather His people, circumcise the heart, and set before them life and good, death and evil.",
      "The Torah is not in heaven or across the sea; it is very near, in the mouth and heart, to do it.",
      "This portion is deeply uplifting because no Jew is missing from the covenant.",
      "The highest and lowest stand together, equally needed before God.",
      "Nitzavim also removes despair: return is possible, closeness is near, and choosing life is today.",
      "This week, stand where you are, not where you wish you already were.",
      "Speak one holy word, do one holy act, and choose life with the confidence that the Torah is near."
    ),
    book: "Deuteronomy",
  },
  "Parashat Vayeilech": {
    summary: parashaSummary(
      "Vayeilech shows Moses at the end of his life, still walking forward in service.",
      "From the JPS 1917 Torah, he tells Israel that he is 120 years old, strengthens Joshua, writes the Torah, commands its public reading at Hakhel, and teaches that God will not fail or forsake His people.",
      "The portion is about transition without fear.",
      "Moses will not cross the Jordan, but the mission continues.",
      "A true leader prepares others to walk, and a true people carries Torah into the next generation.",
      "The command to gather men, women, children, and strangers to hear the Torah reminds us that renewal is communal.",
      "This week, Vayeilech invites us to be strong and courageous in our own transitions.",
      "Write down what must endure, encourage the next person, and trust that when one chapter closes, God is already walking with us into the next."
    ),
    book: "Deuteronomy",
  },
  "Parashat Nitzavim-Vayeilech": {
    summary: parashaSummary(
      "Nitzavim-Vayeilech brings all Israel into covenant and then prepares them for movement into the future.",
      "Based on the JPS 1917 Torah, every person stands before God, the Torah is declared near in mouth and heart, life and good are set before the people, Moses strengthens Joshua, writes the Torah, and commands that it be read publicly to the whole nation.",
      "Together the portions teach presence and courage.",
      "First we stand honestly before God as we are; then we walk forward with the Torah in our hands.",
      "No one is too high or too low to be included, and no transition is too frightening when God goes with us.",
      "This week, choose life in a practical way.",
      "Gather your scattered strengths, encourage someone who must lead next, and remember that the Torah is not distant.",
      "It is near enough to speak, near enough to do."
    ),
    book: "Deuteronomy",
  },
  "Parashat Ha'Azinu": {
    summary: parashaSummary(
      "Ha'Azinu is Moses' great song, calling heaven and earth to listen as witnesses.",
      "From the JPS 1917 Torah, the song describes God's perfect work, Israel as His portion, care in the wilderness like an eagle over its young, the danger of forgetting, the pain of consequence, and the certainty that God will ultimately vindicate His people.",
      "A song can hold what ordinary speech cannot: memory, warning, love, grief, and hope together.",
      "Moses teaches Israel to sing its history so that even in distant generations the truth will not be lost.",
      "The portion reminds us that God is the Rock, faithful even when we are unsteady.",
      "This week, Ha'Azinu asks us to listen deeply.",
      "What song is your life teaching?",
      "Return to the Rock, let memory awaken gratitude, and make your words a melody that strengthens faith rather than weakens it."
    ),
    book: "Deuteronomy",
  },
  "Parashat Vezot Haberakhah": {
    summary: parashaSummary(
      "Vezot Haberakhah is the Torah's final portion, in which Moses blesses the tribes of Israel before his passing.",
      "Based on the JPS 1917 Torah, each tribe receives words suited to its path, Moses ascends Mount Nebo, sees the land, and dies there, while Israel mourns the prophet whom God knew face to face.",
      "The Torah ends not with Moses entering the land, but with blessing.",
      "That is a profound lesson: a life is not measured only by crossing every personal finish line, but by what it gives to others before handing the mission forward.",
      "Moses' final act is to see the future and strengthen the people who will enter it.",
      "Then the Torah immediately begins again with Bereishit, because ending becomes beginning.",
      "This week, bless someone for their unique path, release what is not yours to complete, and step into the next cycle with renewed joy."
    ),
    book: "Deuteronomy",
  },
};

const normalizeParashaLookupKey = (name: string): string =>
  name
    .replace(/^Parashat\s+/i, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase();

const NORMALIZED_PARASHA_MAP = Object.entries(PARASHA_MAP).reduce<Record<string, ParashaInfo>>(
  (acc, [name, info]) => {
    acc[normalizeParashaLookupKey(name)] = info;
    return acc;
  },
  {}
);

export const getParashaInfo = (
  hebcalName: string | null | undefined
): ParashaInfo | null => {
  if (!hebcalName) {
    return null;
  }
  const normalizedName = hebcalName.startsWith("Parashat ")
    ? hebcalName
    : `Parashat ${hebcalName}`;
  return (
    PARASHA_MAP[hebcalName] ??
    PARASHA_MAP[normalizedName] ??
    NORMALIZED_PARASHA_MAP[normalizeParashaLookupKey(hebcalName)] ??
    null
  );
};

export const getRabbiGordonParashaUrl = (): string => {
  return "https://www.chabad.org/multimedia/video_cdo/aid/903523/jewish/Rabbi-Gordon.htm";
};
