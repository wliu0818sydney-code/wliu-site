/* Original practice passages for 听句概括, written for this site. All people and situations are general or fictional.
   The id is a storage contract: saved attempts refer to it, so never reuse an id for a different passage. */
window.WLIU_SUMMARY_DATA = {
  levels: [
    { id: "one", label: "一句", range: "1 句", min: 1, max: 1 },
    { id: "few", label: "两三句", range: "2 到 3 句", min: 2, max: 3 },
    { id: "short", label: "短段", range: "4 到 6 句", min: 4, max: 6 }
  ],
  topics: { everyday: "日常", campus: "校园", work: "职场", science: "科普", opinion: "观点" },
  passages: [
    {
      id: "one-1", level: "one", topic: "everyday",
      sentences: ["I was going to cook tonight, but the fridge is almost empty, so I think we should just pick something up on the way home."],
      keys: ["本来打算今晚做饭", "冰箱快空了", "提议回家路上买吃的"],
      zh: "冰箱快空了，今晚不做饭，回家路上买点吃的。",
      en: "The fridge is nearly empty, so let's buy food on the way home."
    },
    {
      id: "one-2", level: "one", topic: "campus",
      sentences: ["If you can't make it to the seminar on Thursday, just email your tutor beforehand and they'll send you the reading notes."],
      keys: ["周四的研讨课来不了的情况", "提前给导师发邮件", "导师会发阅读笔记"],
      zh: "周四来不了研讨课的话，提前发邮件给导师，就能拿到阅读笔记。",
      en: "If you miss Thursday's seminar, email your tutor first to get the notes."
    },
    {
      id: "one-3", level: "one", topic: "work",
      sentences: ["The client has moved the meeting to Monday morning, which gives us the weekend to fix the slides, though I'd honestly rather finish them tomorrow."],
      keys: ["客户把会议改到周一上午", "多出周末可以改幻灯片", "说话人更想明天就做完"],
      zh: "会议改到周一上午，周末也能改幻灯片，但说话人想明天做完。",
      en: "The meeting moved to Monday, but the speaker wants to finish the slides tomorrow."
    },
    {
      id: "one-4", level: "one", topic: "science",
      sentences: ["Your ears actually help you keep your balance, because tiny fluid-filled tubes inside them tell your brain which way your head is moving."],
      keys: ["耳朵帮助保持平衡", "耳内有充满液体的小管", "它们告诉大脑头部如何移动"],
      zh: "耳朵里充满液体的小管把头部的运动告诉大脑，帮我们保持平衡。",
      en: "Small fluid-filled tubes in the ear help us balance by sensing head movement."
    },
    {
      id: "one-5", level: "one", topic: "opinion",
      sentences: ["I know paper maps sound old-fashioned, but I think using one now and then makes you pay far more attention to where you actually are."],
      keys: ["纸质地图听起来过时", "说话人觉得偶尔用一用有好处", "能让人更留意自己身在何处"],
      zh: "纸质地图虽然老派，但偶尔用一用会让人更留意自己在哪儿。",
      en: "Paper maps seem old, but they make you notice where you are."
    },
    {
      id: "few-1", level: "few", topic: "everyday",
      sentences: [
        "The washing machine in our building has been broken since Sunday.",
        "The landlord says someone will come and look at it on Friday.",
        "Until then, I'm taking my clothes to the launderette down the road."
      ],
      keys: ["楼里的洗衣机周日起就坏了", "房东说周五有人来看", "这期间去街上的自助洗衣店"],
      zh: "洗衣机坏了，周五才有人来看，这期间说话人去外面的洗衣店。",
      en: "The washing machine is broken and won't be checked until Friday, so the speaker uses a launderette."
    },
    {
      id: "few-2", level: "few", topic: "campus",
      sentences: [
        "The library's closing early this week because they're replacing the heating.",
        "So if you need somewhere quiet in the evening, try the study rooms in the science building.",
        "You'll have to book one online first, though."
      ],
      keys: ["图书馆这周提前关门", "原因是在更换供暖", "晚上可以去科学楼的自习室", "自习室要先在网上预约"],
      zh: "图书馆因换供暖这周早关，晚上可去科学楼自习室，但要先网上预约。",
      en: "The library closes early this week, so book a study room in the science building."
    },
    {
      id: "few-3", level: "few", topic: "work",
      sentences: [
        "We've been getting a lot of complaints about the new booking form.",
        "Most people say it's fine on a laptop, but really awkward on a phone.",
        "Could you take a look at the mobile version before we change anything else?"
      ],
      keys: ["新预订表单收到很多投诉", "问题主要出在手机上", "请对方先看手机版"],
      zh: "新预订表单在手机上很难用，投诉不少，请先看看手机版。",
      en: "People complain the booking form is hard to use on phones, so check that first."
    },
    {
      id: "few-4", level: "few", topic: "science",
      sentences: [
        "Leaves change colour in autumn because trees stop making the green pigment when the days get shorter.",
        "The green fades, and the yellows and oranges that were there all along start to show."
      ],
      keys: ["白天变短后树不再制造绿色色素", "绿色褪去", "黄色和橙色其实一直都在，这时才显出来"],
      zh: "秋天日照变短，树不再产生绿色素，原本就有的黄色和橙色就露出来了。",
      en: "In autumn the green fades, which reveals yellow and orange that were already there."
    },
    {
      id: "few-5", level: "few", topic: "opinion",
      sentences: [
        "People say working from home saves time, and it does.",
        "But I've noticed I miss the short chats in the corridor, because that's often where the best ideas come from.",
        "For me, a couple of days in the office is the right balance."
      ],
      keys: ["承认在家办公确实省时间", "怀念走廊里的闲聊，好点子常来自那里", "认为去办公室两三天是最合适的平衡"],
      zh: "在家办公省时间，但少了能激发想法的闲聊，所以去办公室两三天最合适。",
      en: "Home working saves time, but casual chats matter, so a mix is best."
    },
    {
      id: "short-1", level: "short", topic: "everyday",
      sentences: [
        "Last weekend my neighbour knocked on my door looking really worried.",
        "Her cat had slipped out through a window that morning and hadn't come back.",
        "We walked around the block together calling its name, but we had no luck.",
        "Then, just as it was getting dark, I heard a faint noise coming from my garage.",
        "The cat must have wandered in while I was unloading the car.",
        "She was so relieved that she baked me a cake the next day."
      ],
      keys: ["邻居的猫早上从窗户跑了", "两人一起找，没找到", "傍晚在说话人的车库里发现了猫", "邻居烤了蛋糕表示感谢"],
      zh: "邻居的猫跑丢了，一起找没找到，傍晚发现它在说话人的车库，邻居烤蛋糕道谢。",
      en: "A neighbour's lost cat turned up in the speaker's garage, and she baked a thank-you cake."
    },
    {
      id: "short-2", level: "short", topic: "campus",
      sentences: [
        "Our group project nearly fell apart last term.",
        "We'd split the work evenly, but nobody checked how the sections fitted together.",
        "A week before the deadline, we realised two of us had written about the same thing.",
        "So we met in the canteen, cut one section, and rewrote the introduction together.",
        "It wasn't our best work, but we handed it in on time.",
        "This term, we're planning to meet every week from the start."
      ],
      keys: ["分工后没人检查各部分是否衔接", "截止前一周发现两人写了同样内容", "删掉一部分并重写引言，按时交了", "这学期打算从一开始就每周碰头"],
      zh: "小组作业没人统筹，临近截止才发现内容重复，赶紧改完按时交，这学期决定每周碰头。",
      en: "Poor coordination nearly ruined a group project, so now they will meet every week."
    },
    {
      id: "short-3", level: "short", topic: "work",
      sentences: [
        "When I started at the café, I thought the hardest part would be remembering the orders.",
        "It turned out the real problem was the morning rush.",
        "Everyone wants coffee at the same time, and they're all in a hurry.",
        "An older colleague told me to stop looking at the whole queue and just focus on the next customer.",
        "It sounds simple, but it really calmed me down."
      ],
      keys: ["原以为最难的是记点单", "其实最难的是早高峰", "同事建议只关注下一位顾客", "这个办法让说话人冷静下来"],
      zh: "咖啡馆工作最难的是早高峰，同事建议只看下一位顾客，这让说话人平静了许多。",
      en: "The morning rush was hardest until a colleague said to focus only on the next customer."
    },
    {
      id: "short-4", level: "short", topic: "science",
      sentences: [
        "Have you ever wondered why you see lightning before you hear thunder?",
        "The two actually happen at the same moment.",
        "The difference is that light travels much, much faster than sound.",
        "So the flash reaches you almost instantly, while the sound takes its time.",
        "That's why counting the seconds between them gives you a rough idea of how far away the storm is."
      ],
      keys: ["闪电和雷声其实同时发生", "光比声音快得多，所以先看到闪电", "数两者之间的秒数能大致估计风暴距离"],
      zh: "闪电和雷声同时发生，但光比声音快，所以间隔的秒数可以用来估计风暴的远近。",
      en: "Light is faster than sound, so the gap between flash and thunder shows the storm's distance."
    },
    {
      id: "short-5", level: "short", topic: "opinion",
      sentences: [
        "I think every neighbourhood needs more places where you can sit down without having to buy anything.",
        "Right now, if you want to meet a friend, you usually end up paying for a coffee.",
        "That's fine for some people, but it quietly leaves others out.",
        "A few benches, a small park or a library with comfortable chairs doesn't cost that much.",
        "And it means older people and teenagers have somewhere to go too."
      ],
      keys: ["社区需要更多不用消费就能坐的地方", "现在见朋友通常得花钱，有些人因此被排除在外", "长椅、小公园、图书馆成本不高", "老人和青少年也能有去处"],
      zh: "社区应多些免费的休息空间：现在见面常要花钱，而长椅、公园成本不高，老人和青少年也有去处。",
      en: "Neighbourhoods need low-cost places where people can sit without paying, so everyone has somewhere to go."
    }
  ]
};
