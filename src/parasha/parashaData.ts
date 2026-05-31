export type ParashaInfo = {
  summary: string;
  book: string;
};

const PARASHA_MAP: Record<string, ParashaInfo> = {
  "Parashat Bereishit": {
    summary:
      "God creates the world in six days and rests on the seventh. Adam and Eve are placed in the Garden of Eden but are expelled after eating from the Tree of Knowledge. Cain and Abel's story unfolds as humanity begins to spread across the earth.",
    book: "Genesis",
  },
  "Parashat Noach": {
    summary:
      "God instructs Noah to build an ark to survive a great flood that will cleanse the earth. After the waters recede, God establishes a covenant symbolized by the rainbow, promising never to destroy the world by flood again.",
    book: "Genesis",
  },
  "Parashat Lech-Lecha": {
    summary:
      "God calls Abraham to leave his homeland and journey to the Promised Land. God makes a covenant with Abraham, promising him countless descendants and the land of Israel.",
    book: "Genesis",
  },
  "Parashat Vayera": {
    summary:
      "Three angels visit Abraham with news of Isaac's future birth. God tests Abraham by asking him to sacrifice his son Isaac on Mount Moriah, and Abraham's faith prevails.",
    book: "Genesis",
  },
  "Parashat Chayei Sara": {
    summary:
      "Sarah passes away at age 127 and Abraham purchases a burial plot in Hebron. Abraham's servant Eliezer journeys to find a wife for Isaac and discovers Rebecca at the well.",
    book: "Genesis",
  },
  "Parashat Toldot": {
    summary:
      "Isaac and Rebecca have twin sons, Esau and Jacob, who struggle even before birth. Jacob acquires the birthright and receives Isaac's primary blessing, setting the stage for the future of the Jewish people.",
    book: "Genesis",
  },
  "Parashat Vayetzei": {
    summary:
      "Jacob flees to his uncle Laban and dreams of a ladder reaching heaven with angels ascending and descending. He works fourteen years to marry Rachel and Leah, and the twelve tribes of Israel begin to take shape.",
    book: "Genesis",
  },
  "Parashat Vayishlach": {
    summary:
      "Jacob prepares to meet his brother Esau after years apart and wrestles with an angel through the night. He receives the name Israel, meaning 'one who has struggled with God and prevailed.'",
    book: "Genesis",
  },
  "Parashat Vayeshev": {
    summary:
      "Jacob's son Joseph is sold into slavery by his jealous brothers after sharing his prophetic dreams. Joseph ends up in Egypt where he rises in Potiphar's house but is imprisoned after being falsely accused.",
    book: "Genesis",
  },
  "Parashat Miketz": {
    summary:
      "Joseph interprets Pharaoh's dreams about seven years of plenty followed by seven years of famine. He rises to become viceroy of Egypt, and his brothers arrive seeking food without recognizing him.",
    book: "Genesis",
  },
  "Parashat Vayigash": {
    summary:
      "Judah pleads passionately before Joseph to save their youngest brother Benjamin. Joseph reveals his true identity to his stunned brothers, and the entire family reunites and moves to Egypt.",
    book: "Genesis",
  },
  "Parashat Vayechi": {
    summary:
      "Jacob blesses each of his twelve sons with prophecies about their future tribes before passing away in Egypt. Joseph promises that God will eventually bring the family back to the Promised Land.",
    book: "Genesis",
  },
  "Parashat Shemot": {
    summary:
      "The Israelites are enslaved in Egypt and Pharaoh decrees that all Hebrew baby boys be drowned. Moses is saved by Pharaoh's daughter, grows up in the palace, and encounters God at the burning bush.",
    book: "Exodus",
  },
  "Parashat Vaera": {
    summary:
      "God sends the first seven plagues upon Egypt through Moses and Aaron, turning water to blood, bringing frogs, lice, and more. Despite the devastation, Pharaoh's heart remains hardened and he refuses to free the Israelites.",
    book: "Exodus",
  },
  "Parashat Bo": {
    summary:
      "The final three plagues strike Egypt, culminating in the death of the firstborn at midnight. Pharaoh finally relents and the Israelites begin their exodus, marking the very first Passover.",
    book: "Exodus",
  },
  "Parashat Beshalach": {
    summary:
      "The Israelites cross the Red Sea as God miraculously splits the waters, and the pursuing Egyptian army is swallowed. They sing a song of praise and later receive manna from heaven in the desert.",
    book: "Exodus",
  },
  "Parashat Yitro": {
    summary:
      "The Israelites arrive at Mount Sinai where God gives the Ten Commandments amid thunder, lightning, and the sound of the shofar. Moses' father-in-law Jethro advises him to establish a system of judges.",
    book: "Exodus",
  },
  "Parashat Mishpatim": {
    summary:
      "God gives Moses a comprehensive set of civil laws and ethical ordinances covering justice, property, and compassion. The people affirm their commitment, declaring 'We will do and we will hear.'",
    book: "Exodus",
  },
  "Parashat Terumah": {
    summary:
      "God instructs the Israelites to contribute materials and build a Tabernacle as a dwelling place for the Divine Presence. Detailed plans are given for the Ark, Table, Menorah, and the structure itself.",
    book: "Exodus",
  },
  "Parashat Tetzaveh": {
    summary:
      "Instructions are given for crafting the sacred garments of the High Priest Aaron and his sons. The eternal flame of the Menorah is established and the golden altar of incense is described.",
    book: "Exodus",
  },
  "Parashat Ki Tisa": {
    summary:
      "While Moses is on Mount Sinai for forty days, the Israelites create a Golden Calf. Moses breaks the tablets in anguish, prays for forgiveness, and God renews the covenant with a second set.",
    book: "Exodus",
  },
  "Parashat Vayakhel": {
    summary:
      "Moses assembles the entire community and they generously donate materials to build the Tabernacle. The artisan Bezalel leads the construction with divinely-inspired wisdom and skill.",
    book: "Exodus",
  },
  "Parashat Pekudei": {
    summary:
      "The construction of the Tabernacle is completed and Moses carefully inspects every detail of the work. God's glory fills the Tabernacle, and a cloud guides the Israelites on their journey.",
    book: "Exodus",
  },
  "Parashat Vayakhel-Pekudei": {
    summary:
      "Moses assembles the community to build the Tabernacle with generous donations and skilled craftsmanship. Upon completion, God's glory fills the sanctuary, and a cloud guides the Israelites on their journey.",
    book: "Exodus",
  },
  "Parashat Vayikra": {
    summary:
      "God calls to Moses from the Tent of Meeting and teaches the laws of offerings and sacrifices. Various types including burnt offerings, meal offerings, and peace offerings are described in detail.",
    book: "Leviticus",
  },
  "Parashat Tzav": {
    summary:
      "Additional laws of the offerings are given to Aaron and the priests, including the consecration ceremony. Aaron and his sons are anointed and begin their sacred service in the Tabernacle.",
    book: "Leviticus",
  },
  "Parashat Shmini": {
    summary:
      "On the eighth day of the Tabernacle's inauguration, Aaron brings offerings and God's fire appears before the people. Tragically, Aaron's sons Nadav and Avihu die after bringing unauthorized fire before God.",
    book: "Leviticus",
  },
  "Parashat Tazria": {
    summary:
      "Laws regarding ritual purity after childbirth are given. The Torah describes the signs of tzaraat, a spiritual skin condition, and the priest's crucial role in its diagnosis.",
    book: "Leviticus",
  },
  "Parashat Metzora": {
    summary:
      "The detailed purification process for one healed of tzaraat involves offerings, immersion, and a seven-day period. Laws about tzaraat appearing on garments and houses are also described.",
    book: "Leviticus",
  },
  "Parashat Tazria-Metzora": {
    summary:
      "Laws of ritual purity, the spiritual skin condition of tzaraat, and its detailed purification process are taught. The priest plays a central role in diagnosing conditions and declaring purity.",
    book: "Leviticus",
  },
  "Parashat Achrei Mot": {
    summary:
      "The Yom Kippur service is described in detail, including the High Priest entering the Holy of Holies and the scapegoat ritual. Important prohibitions regarding certain relationships and practices are established.",
    book: "Leviticus",
  },
  "Parashat Kedoshim": {
    summary:
      "God commands 'Be holy, for I the Lord your God am holy' and gives laws for ethical living. This portion contains the famous verse 'Love your neighbor as yourself,' a cornerstone of the Torah.",
    book: "Leviticus",
  },
  "Parashat Achrei Mot-Kedoshim": {
    summary:
      "The Yom Kippur service and holiness code are taught together. God commands ethical living with the famous directive 'Love your neighbor as yourself.'",
    book: "Leviticus",
  },
  "Parashat Emor": {
    summary:
      "Special laws for the kohanim (priests) regarding their sanctity and service are detailed. The biblical holidays and festivals throughout the Jewish year are enumerated and explained.",
    book: "Leviticus",
  },
  "Parashat Behar": {
    summary:
      "The laws of the Sabbatical year (Shmita) every seven years and the Jubilee year every fifty years are taught. God promises blessings and sustenance for those who trust in divine provision.",
    book: "Leviticus",
  },
  "Parashat Bechukotai": {
    summary:
      "God promises abundant blessings for following the commandments and warns of difficult consequences for abandoning them. Despite everything, God assures that the eternal covenant with Israel will never be broken.",
    book: "Leviticus",
  },
  "Parashat Behar-Bechukotai": {
    summary:
      "The Sabbatical and Jubilee years teach trust in God's provision. Blessings are promised for faithfulness, and God assures the covenant with Israel will endure forever.",
    book: "Leviticus",
  },
  "Parashat Bamidbar": {
    summary:
      "A census of all the Israelites is taken in the wilderness of Sinai, counting every tribe. The arrangement of the tribal camps around the Tabernacle is established in precise formation.",
    book: "Numbers",
  },
  "Parashat Nasso": {
    summary:
      "The census is completed and specific duties of each Levite family are assigned. The beautiful threefold priestly blessing and the laws of the Nazirite vow are given.",
    book: "Numbers",
  },
  "Parashat Beha'alotcha": {
    summary:
      "Aaron kindles the golden Menorah and the Levites are consecrated for their sacred service. The Israelites set out from Sinai, guided by the pillar of cloud and fire.",
    book: "Numbers",
  },
  "Parashat Sh'lach": {
    summary:
      "Twelve spies are sent to scout the Land of Israel; ten return with a frightening report that demoralizes the people. Because of their lack of faith, the generation is decreed to wander forty years in the desert.",
    book: "Numbers",
  },
  "Parashat Korach": {
    summary:
      "Korach leads a dramatic rebellion challenging the leadership of Moses and the priesthood of Aaron. The earth opens and swallows the rebels, and Aaron's staff miraculously blossoms to confirm the priestly line.",
    book: "Numbers",
  },
  "Parashat Chukat": {
    summary:
      "The mysterious Red Heifer purification ritual is taught. Moses strikes the rock instead of speaking to it and is told he will not enter the Promised Land, a deeply poignant moment.",
    book: "Numbers",
  },
  "Parashat Balak": {
    summary:
      "King Balak of Moab hires the prophet Balaam to curse the Israelites camped on his border. Instead, God compels Balaam to bless them, declaring 'How goodly are your tents, O Jacob.'",
    book: "Numbers",
  },
  "Parashat Chukat-Balak": {
    summary:
      "The Red Heifer purification ritual is taught and Moses strikes the rock. King Balak hires Balaam to curse Israel, but God turns curses into blessings: 'How goodly are your tents, O Jacob.'",
    book: "Numbers",
  },
  "Parashat Pinchas": {
    summary:
      "Pinchas is rewarded with a covenant of peace for his zealous action defending God's honor. A new census is taken and the five daughters of Zelophehad successfully advocate for women's inheritance rights.",
    book: "Numbers",
  },
  "Parashat Matot": {
    summary:
      "Laws of vows and oaths teach the power and responsibility of spoken words. The tribes of Reuben, Gad, and half of Manasseh negotiate to settle on the east bank of the Jordan River.",
    book: "Numbers",
  },
  "Parashat Masei": {
    summary:
      "The forty-two journeys of the Israelites through the wilderness are recounted from Egypt to the Jordan. The borders of the Promised Land are defined and cities of refuge for accidental harm are established.",
    book: "Numbers",
  },
  "Parashat Matot-Masei": {
    summary:
      "Laws of vows are taught and the wilderness journeys are recounted. The eastern tribes negotiate their territory and cities of refuge are established in the Promised Land.",
    book: "Numbers",
  },
  "Parashat Devarim": {
    summary:
      "Moses begins his farewell address to the Israelites, recounting their forty-year journey through the wilderness. He reminds them of past triumphs and failures as they prepare to enter the Promised Land.",
    book: "Deuteronomy",
  },
  "Parashat Vaetchanan": {
    summary:
      "Moses pleads with God to enter the land but is denied. He restates the Ten Commandments and teaches the Shema, the foundational declaration of God's oneness: 'Hear O Israel, the Lord is our God, the Lord is One.'",
    book: "Deuteronomy",
  },
  "Parashat Eikev": {
    summary:
      "Moses urges the people to keep God's commandments and trust in divine provision. He describes the beauty and bounty of the Promised Land and warns against the pride that comes with prosperity.",
    book: "Deuteronomy",
  },
  "Parashat Re'eh": {
    summary:
      "Moses presents a fundamental choice: blessing for following God's ways, or curse for straying. Laws about centralized worship, kosher dietary rules, and generous charity are given.",
    book: "Deuteronomy",
  },
  "Parashat Shoftim": {
    summary:
      "Moses establishes a just system of judges, officers, and courts for the nation. The famous command 'Justice, justice shall you pursue' anchors laws about kings, prophets, and warfare.",
    book: "Deuteronomy",
  },
  "Parashat Ki Teitzei": {
    summary:
      "A sweeping collection of seventy-four mitzvot covers marriage, business ethics, compassion, and daily life. Laws about caring for lost property, honest weights, and kindness to animals reveal the Torah's ethical vision.",
    book: "Deuteronomy",
  },
  "Parashat Ki Tavo": {
    summary:
      "Moses describes the joyful ceremony of bringing first fruits to the Temple with words of gratitude. Blessings for faithfulness and warnings for disobedience are dramatically pronounced on the mountains of Gerizim and Ebal.",
    book: "Deuteronomy",
  },
  "Parashat Nitzavim": {
    summary:
      "Moses gathers every Israelite for a powerful renewal of the covenant with God. He teaches that the Torah is not distant or inaccessible: 'It is not in heaven... it is very near to you, in your mouth and in your heart.'",
    book: "Deuteronomy",
  },
  "Parashat Vayeilech": {
    summary:
      "Moses, at age 120, transfers leadership to Joshua and commits the Torah to writing. He encourages the people to be strong and courageous, assuring them that God will never abandon them.",
    book: "Deuteronomy",
  },
  "Parashat Nitzavim-Vayeilech": {
    summary:
      "Moses renews the covenant with all of Israel and teaches that the Torah is accessible to everyone. He transfers leadership to Joshua and encourages the people to be strong and faithful.",
    book: "Deuteronomy",
  },
  "Parashat Ha'Azinu": {
    summary:
      "Moses delivers his final song, a sweeping poetic testament calling heaven and earth as eternal witnesses. The song recounts God's enduring faithfulness throughout history and warns against future unfaithfulness.",
    book: "Deuteronomy",
  },
  "Parashat Vezot Haberakhah": {
    summary:
      "In the Torah's final portion, Moses blesses each of the twelve tribes with unique gifts and destinies. He ascends Mount Nebo, gazes upon the Promised Land, and passes away at 120 years old.",
    book: "Deuteronomy",
  },
};

export const getParashaInfo = (
  hebcalName: string | null | undefined
): ParashaInfo | null => {
  if (!hebcalName) {
    return null;
  }
  const normalizedName = hebcalName.startsWith("Parashat ")
    ? hebcalName
    : `Parashat ${hebcalName}`;
  return PARASHA_MAP[hebcalName] ?? PARASHA_MAP[normalizedName] ?? null;
};

export const getChabadParashaUrl = (): string => {
  return "https://www.chabad.org/parshah/default.htm";
};
