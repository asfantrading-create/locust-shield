/* Locust Shield configuration shared by the page and the daily runner. */
(function (root) {
  "use strict";
  const C = {};
  C.KAIG = { lat: 24.53, lon: 46.46 };
  C.BBOX = { W: 24, E: 60, S: 4, N: 34 };
  C.GRID_LATS = [10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5];
  C.GRID_LONS = [30, 32.5, 35, 37.5, 40, 42.5, 45, 47.5, 50, 52.5, 55];
  /* breeding areas (FAO seasonal breeding calendar); g = map colour group */
  C.SOURCES = [
    { ar: "دلتا طوكر – ساحل السودان", en: "Tokar Delta – Sudan coast", lat: 18.4, lon: 37.7, g: 0, s: "winter" },
    { ar: "ساحل إريتريا", en: "Eritrea coast", lat: 15.8, lon: 39.2, g: 0, s: "winter" },
    { ar: "جنوب شرق مصر (حلايب)", en: "SE Egypt (Halaib)", lat: 22.0, lon: 36.4, g: 0, s: "winter" },
    { ar: "تهامة السعودية (جازان–القنفذة)", en: "Saudi Tihama (Jazan–Qunfudhah)", lat: 18.0, lon: 41.8, g: 2, s: "winter" },
    { ar: "ساحل البحر الأحمر الشمالي (ينبع–الوجه)", en: "North Red Sea coast (Yanbu–Al Wajh)", lat: 23.5, lon: 38.8, g: 2, s: "winter" },
    { ar: "تهامة اليمن", en: "Yemen Tihama", lat: 15.0, lon: 43.1, g: 1, s: "winter" },
    { ar: "داخل السودان", en: "Interior Sudan", lat: 16.5, lon: 31.5, g: 0, s: "summer" },
    { ar: "داخل اليمن (مأرب–شبوة)", en: "Interior Yemen (Marib–Shabwah)", lat: 15.5, lon: 46.5, g: 1, s: "summer" },
    { ar: "شمال غرب الصومال وشرق إثيوبيا", en: "NW Somalia & E Ethiopia", lat: 10.5, lon: 44.0, g: 1, s: "horn" },
    { ar: "القصيم – حائل", en: "Qassim – Hail", lat: 26.5, lon: 43.5, g: 2, s: "spring" },
    { ar: "وادي الدواسر – السليل", en: "Wadi Dawasir – Sulayyil", lat: 20.5, lon: 45.0, g: 2, s: "spring" },
    { ar: "الربع الخالي – حدود عُمان", en: "Empty Quarter – Oman border", lat: 20.0, lon: 51.0, g: 2, s: "spring" }
  ];
  /* documented events used to test the model (ERA5 winds, MODIS NDVI of the time) */
  C.EVENTS = [
    {
      id: "e2020feb",
      ar: "فبراير 2020: من جنوب المملكة إلى الرياض والخليج", en: "Feb 2020: southern Saudi Arabia to Riyadh and the Gulf",
      noteAr: "أسراب دخلت نجران من اليمن وانتشرت في عسير وتهامة، ثم حملتها رياح قوية إلى الرياض والقصيم وحائل والمنطقة الشرقية والكويت والبحرين وقطر بين 19 و22 فبراير.",
      noteEn: "Swarms entered Najran from Yemen and spread in Asir and Tihama; strong winds carried them to Riyadh, Qassim, Hail, the Eastern Province, Kuwait, Bahrain and Qatar on 19–22 February.",
      start: "2020-02-10T00:00Z",
      release: [{ lat: 17.6, lon: 44.3 }, { lat: 18.3, lon: 42.3 }, { lat: 19.6, lon: 40.9 }],
      obs: [
        { ar: "منطقة الرياض", en: "Riyadh region", lat: 24.7, lon: 46.7, date: "2020-02-22", r: 150, src: "Arab News 19 Feb 2020; The Watchers 22 Feb 2020" },
        { ar: "القصيم", en: "Qassim", lat: 26.3, lon: 43.97, date: "2020-02-22", r: 150, src: "The Watchers 22 Feb 2020" },
        { ar: "الخبر – الدمام", en: "Al Khobar – Dammam", lat: 26.3, lon: 50.15, date: "2020-02-21", r: 150, src: "Social posts 20–21 Feb 2020 (The Watchers)" },
        { ar: "الكويت", en: "Kuwait", lat: 29.3, lon: 47.9, date: "2020-02-21", r: 150, src: "USAID ETOP bulletin, Feb 2020" },
        { ar: "البحرين وقطر", en: "Bahrain & Qatar", lat: 25.8, lon: 51.0, date: "2020-02-21", r: 150, src: "USAID ETOP bulletin, Feb 2020" }
      ]
    },
    {
      id: "e2019jan",
      ar: "يناير 2019: من الربع الخالي إلى حوافه المزروعة", en: "Jan 2019: Empty Quarter to its farmed edges",
      noteAr: "بعد أمطار إعصارين في 2018 تكاثر الجراد في جنوب شرق الربع الخالي قرب حدود اليمن وعُمان، ثم غزت الأسراب المزارع على الحافتين الغربية والشمالية للربع الخالي.",
      noteEn: "After two 2018 cyclones, locusts bred in the SE Empty Quarter near the Yemen/Oman border; swarms then invaded farms on the western and northern edges of the Empty Quarter.",
      start: "2019-01-02T00:00Z",
      release: [{ lat: 18.8, lon: 52.0 }, { lat: 19.5, lon: 51.0 }],
      obs: [
        { ar: "الحافة الشمالية (حرض – يبرين)", en: "Northern edge (Haradh – Yabrin)", lat: 23.7, lon: 49.0, date: "2019-01-24", r: 150, src: "FAO Desert Locust Bulletin 484 (Jan 2019)" },
        { ar: "الحافة الغربية (السليل – وادي الدواسر)", en: "Western edge (Sulayyil – Wadi Dawasir)", lat: 20.46, lon: 45.57, date: "2019-01-24", r: 150, src: "FAO Desert Locust Bulletin 484 (Jan 2019)" }
      ]
    },
    {
      id: "e2019dec",
      ar: "ديسمبر 2019: من ساحل البحر الأحمر إلى الداخل", en: "Dec 2019: Red Sea coast to the interior",
      noteAr: "تكاثر واسع على ساحل البحر الأحمر السعودي، وانتقلت أسراب قليلة غير ناضجة إلى الداخل أواخر ديسمبر، مع عمليات مكافحة في الرياض والقصيم وحائل في النصف الثاني من الشهر.",
      noteEn: "Widespread breeding on the Saudi Red Sea coast; a few immature swarms moved into the interior in late December, with control in Riyadh, Qassim and Hail in the second half of the month.",
      start: "2019-12-14T00:00Z",
      release: [{ lat: 20.15, lon: 40.3 }, { lat: 19.1, lon: 41.1 }, { lat: 17.0, lon: 42.6 }],
      obs: [
        { ar: "منطقة الرياض", en: "Riyadh region", lat: 24.7, lon: 46.7, date: "2019-12-31", r: 150, src: "SPA via Gulf Business, Jan 2020; FAO" },
        { ar: "القصيم", en: "Qassim", lat: 26.3, lon: 43.97, date: "2019-12-31", r: 150, src: "SPA via Gulf Business, Jan 2020" },
        { ar: "حائل", en: "Hail", lat: 27.52, lon: 41.69, date: "2019-12-31", r: 150, src: "SPA via Gulf Business, Jan 2020" }
      ]
    }
  ];
  C.EVENTS.push({
    id: "e2013feb",
    ar: "فبراير 2013: عبور البحر الأحمر إلى شمال غرب المملكة", en: "Feb 2013: across the Red Sea to NW Saudi Arabia",
    noteAr: "شتاء 2012–2013 شهد تفشياً في مناطق التكاثر الشتوي بالسودان ومصر. في أواخر فبراير دخل سربان المملكة عند تبوك ورابغ وأملج، ورُصد الجراد في 99 موقعاً في رابغ و72 في بدر. يُرجّح أنها عبرت البحر الأحمر من تلك المناطق.",
    noteEn: "Winter 2012–2013 saw an outbreak in the Sudan and Egypt winter breeding areas. In late February two swarms entered Saudi Arabia at Tabuk, Rabigh and Umluj, and locusts were found at 99 sites in Rabigh and 72 in Badr, most likely having crossed the Red Sea from those areas.",
    start: "2013-02-18T00:00Z",
    release: [{ lat: 21.8, lon: 36.6 }, { lat: 20.6, lon: 37.2 }, { lat: 18.5, lon: 37.8 }],
    obs: [
      { ar: "رابغ", en: "Rabigh", lat: 22.8, lon: 39.03, date: "2013-03-01", r: 150, src: "Arab News, 7 Mar 2013" },
      { ar: "بدر", en: "Badr", lat: 23.78, lon: 38.79, date: "2013-03-01", r: 150, src: "Arab News, 7 Mar 2013" },
      { ar: "أملج", en: "Umluj", lat: 25.05, lon: 37.27, date: "2013-03-01", r: 150, src: "Arab News, 7 Mar 2013" },
      { ar: "تبوك", en: "Tabuk", lat: 28.38, lon: 36.57, date: "2013-03-01", r: 150, src: "Arab News, 7 Mar 2013" }
    ]
  });
  /* garden zones on a 900×560 plan (1 unit ≈ 2.2 m); B = edible green biomass (t); value = replacement value (SAR) */
  C.ZONES = [
    { id: "dome", ar: "قبة البيئات النباتية", en: "Biome conservatory", B: 60, pal: .9, val: 5, rec: 12, value: 25e6, costF: .9, shape: "ellipse", g: [450, 265, 115, 72] },
    { id: "water", ar: "البحيرة والحدائق المائية", en: "Lake & water gardens", B: 50, pal: .8, val: 2, rec: 6, value: 4e6, costF: .4, shape: "ellipse", g: [455, 112, 135, 42] },
    { id: "palms", ar: "واحة النخيل", en: "Palm oasis", B: 120, pal: .5, val: 4, rec: 26, value: 15e6, costF: .5, shape: "rect", g: [80, 70, 200, 180] },
    { id: "flowers", ar: "الحدائق المزهرة والإسلامية", en: "Flower & Islamic gardens", B: 80, pal: .9, val: 3, rec: 6, value: 8e6, costF: .6, nets: true, shape: "rect", g: [630, 70, 200, 165] },
    { id: "nursery", ar: "المشتل والبذور", en: "Nursery & seed bank", B: 25, pal: 1, val: 4, rec: 8, value: 6e6, costF: 1, nets: true, shape: "rect", g: [80, 375, 170, 120] },
    { id: "desert", ar: "حديقة النباتات الصحراوية", en: "Native desert garden", B: 90, pal: .6, val: 3, rec: 20, value: 10e6, costF: .8, shape: "rect", g: [290, 385, 320, 115] },
    { id: "lawn", ar: "المسطحات الخضراء والساحات", en: "Lawns & plazas", B: 150, pal: 1, val: 1, rec: 3, value: 3e6, costF: .25, shape: "rect", g: [650, 330, 180, 165] }
  ];
  /* places where chemical spraying is restricted (plan coordinates) */
  C.SITES = [
    { id: "lake", ar: "البحيرة", en: "Lake", x: 455, y: 112 },
    { id: "bees", ar: "خلايا النحل", en: "Beehives", x: 860, y: 520 },
    { id: "kids", ar: "ملعب الأطفال", en: "Children's play area", x: 560, y: 520 },
    { id: "visit", ar: "مركز الزوار", en: "Visitor centre", x: 470, y: 30 }
  ];
  C.MEASURES = [
    { id: "pre", lead: 48, cost: 50000, ar: "رش استباقي للسرب خارج المدينة (فرق وقاء)", en: "Pre-emptive control of the swarm outside the city (NCPD teams)", whyAr: "يخفض عدد الجراد الواصل نحو النصف إذا اعتُرض السرب في مجثمه قبل الوصول.", whyEn: "Roughly halves the arriving swarm if it is treated at its roost before arrival." },
    { id: "nets", lead: 72, cost: 350000, ar: "شباك واقية على المشتل والحدائق المزهرة", en: "Protective netting over the nursery and flower gardens", whyAr: "شباك بفتحات ≤ 5 مم تمنع 85% من الوصول. تحتاج نحو 3 أيام للتركيب.", whyEn: "Mesh ≤ 5 mm blocks 85% of access. Needs about 3 days to install." },
    { id: "dome", lead: 2, cost: 20000, ar: "إغلاق القبة وفتحات التهوية وستائر هوائية", en: "Close the conservatory, vents and air curtains", whyAr: "يكاد يمنع دخول الجراد للقبة. سريع التنفيذ لكنه يحتاج إدارة للحرارة داخلها.", whyEn: "Almost blocks entry to the conservatory. Fast, but indoor heat must be managed." },
    { id: "spray", lead: 24, cost: 80000, ar: "رش أرضي للمجثم الليلي عند الفجر (فرق وقاء)", en: "Ground treatment of the night roost at dawn (NCPD teams)", whyAr: "الجراد خامل فجراً بسبب البرودة. يقتل نحو 70% صباح كل يوم مع احترام مناطق الحظر.", whyEn: "Locusts are inactive at dawn. Kills about 70% each morning, respecting no-spray areas." },
    { id: "noise", lead: 1, cost: 10000, ar: "إزعاج بالضجيج والدخان", en: "Noise and smoke deterrence", whyAr: "أثر محدود جداً (نحو 5%) ولا يُعتمد عليه وحده.", whyEn: "Very limited effect (about 5%); never rely on it alone." }
  ];
  /* relative historical risk of swarm arrival in central Arabia by month (invasion record) */
  C.CLIM = [.35, .7, .85, .75, .45, .25, .1, .05, .05, .1, .15, .25];
  /* share of simulated swarms reaching 150 km of Riyadh within ~10 days, by source and month (ERA5 100 m winds ×1.3, days 1–14 of each month, 70 months: 2015–2018 and 2022–2023) */
  C.TRANSPORT = [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0.054, 0.167, 0.121, 0.217, 0.004, 0, 0, 0, 0, 0.03, 0], [0.021, 0.104, 0.058, 0.108, 0.454, 0.046, 0.004, 0, 0, 0.004, 0.03, 0], [0.012, 0.029, 0.029, 0.133, 0.017, 0, 0, 0, 0, 0, 0.005, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0.004, 0.013, 0.013, 0.1, 0.021, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0.008, 0.05, 0.108, 0.104, 0.279, 0.213, 0.475, 0.129, 0.1, 0.025, 0.1, 0.02], [0.15, 0.133, 0.267, 0.275, 0.446, 0.017, 0, 0, 0.004, 0.004, 0.155, 0.025], [0.117, 0.146, 0.267, 0.404, 0.329, 0.017, 0, 0.004, 0.054, 0.008, 0.41, 0.08]];
  root.LocustConfig = C;
})(typeof window !== "undefined" ? window : globalThis);
