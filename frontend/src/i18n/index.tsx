import React, { createContext, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";

export type Lang = "en" | "hi" | "bn";

export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
];

export const SPEECH_LOCALES: Record<Lang, string> = {
  en: "en-US",
  hi: "hi-IN",
  bn: "bn-IN",
};

type Dict = Record<string, [string, string, string]>; // [en, hi, bn]

const D: Dict = {
  goodMorning: ["Good morning", "सुप्रभात", "সুপ্রভাত"],
  goodAfternoon: ["Good afternoon", "नमस्ते", "শুভ অপরাহ্ন"],
  goodEvening: ["Good evening", "शुभ संध्या", "শুভ সন্ধ্যা"],
  healthScore: ["Health Score", "स्वास्थ्य स्कोर", "স্বাস্থ্য স্কোর"],
  adherenceWeek: ["medicine adherence this week", "इस सप्ताह दवा पालन", "এই সপ্তাহে ওষুধ মেনে চলা"],
  todaysMedicines: ["Today's Medicines", "आज की दवाइयाँ", "আজকের ওষুধ"],
  viewAll: ["View all", "सभी देखें", "সব দেখুন"],
  noMedsScheduled: ["No medicines scheduled. Upload a prescription to build your schedule.", "कोई दवा निर्धारित नहीं है। अपना शेड्यूल बनाने के लिए पर्चा अपलोड करें।", "কোনো ওষুধ নির্ধারিত নেই। সময়সূচি তৈরি করতে প্রেসক্রিপশন আপলোড করুন।"],
  done: ["Done", "पूर्ण", "সম্পন্ন"],
  pending: ["Pending", "बाकी", "বাকি"],
  skipped: ["Skipped", "छोड़ी", "বাদ"],
  scanReport: ["Scan Report", "रिपोर्ट स्कैन", "রিপোর্ট স্ক্যান"],
  askAI: ["Ask AI", "AI से पूछें", "AI-কে জিজ্ঞাসা"],
  emergency: ["Emergency", "आपातकाल", "জরুরি"],
  analytics: ["Analytics", "विश्लेषण", "বিশ্লেষণ"],
  recentReports: ["Recent Reports", "हाल की रिपोर्ट", "সাম্প্রতিক রিপোর্ট"],
  seeAll: ["See all", "सभी देखें", "সব দেখুন"],
  uploadFirst: ["Upload your first report", "अपनी पहली रिपोर्ट अपलोड करें", "আপনার প্রথম রিপোর্ট আপলোড করুন"],
  uploadFirstSub: ["Scan a prescription or lab report and let AI explain it simply.", "पर्चा या लैब रिपोर्ट स्कैन करें और AI से सरल व्याख्या पाएँ।", "প্রেসক্রিপশন বা ল্যাব রিপোর্ট স্ক্যান করুন এবং AI সহজভাবে ব্যাখ্যা করবে।"],
  uploadReport: ["Upload Report", "रिपोर्ट अपलोड करें", "রিপোর্ট আপলোড করুন"],
  // timeline
  medicineTimeline: ["Medicine Timeline", "दवा समय-सारणी", "ওষুধের সময়রেখা"],
  morning: ["Morning", "सुबह", "সকাল"],
  afternoon: ["Afternoon", "दोपहर", "দুপুর"],
  evening: ["Evening", "शाम", "সন্ধ্যা"],
  night: ["Night", "रात", "রাত"],
  all: ["All", "सभी", "সব"],
  nothingScheduled: ["Nothing scheduled", "कुछ निर्धारित नहीं", "কিছু নির্ধারিত নেই"],
  noMedsTitle: ["No medicines scheduled", "कोई दवा निर्धारित नहीं", "কোনো ওষুধ নির্ধারিত নেই"],
  noMedsSub: ["Upload a prescription and your schedule will appear here automatically.", "पर्चा अपलोड करें, आपका शेड्यूल यहाँ अपने आप दिखेगा।", "প্রেসক্রিপশন আপলোড করুন, সময়সূচি এখানে দেখা যাবে।"],
  skip: ["Skip", "छोड़ें", "বাদ দিন"],
  taken: ["Taken", "ले ली", "নেওয়া হয়েছে"],
  // chat
  aiAssistant: ["AI Assistant", "AI सहायक", "AI সহকারী"],
  disclaimerShort: ["Educational info only — not medical advice. Consult your doctor.", "केवल शैक्षिक जानकारी — चिकित्सा सलाह नहीं। डॉक्टर से परामर्श करें।", "শুধুমাত্র শিক্ষামূলক তথ্য — চিকিৎসা পরামর্শ নয়। ডাক্তারের পরামর্শ নিন।"],
  askPlaceholder: ["Ask about your medicines or reports…", "अपनी दवाओं या रिपोर्ट के बारे में पूछें…", "আপনার ওষুধ বা রিপোর্ট সম্পর্কে জিজ্ঞাসা করুন…"],
  askAboutReports: ["Ask me about your reports", "अपनी रिपोर्ट के बारे में मुझसे पूछें", "আপনার রিপোর্ট সম্পর্কে আমাকে জিজ্ঞাসা করুন"],
  // history
  medicalHistory: ["Medical History", "चिकित्सा इतिहास", "চিকিৎসা ইতিহাস"],
  searchPlaceholder: ["Search reports, medicines, symptoms…", "रिपोर्ट, दवाएँ, लक्षण खोजें…", "রিপোর্ট, ওষুধ, উপসর্গ খুঁজুন…"],
  prescriptions: ["Prescriptions", "पर्चे", "প্রেসক্রিপশন"],
  labReports: ["Lab Reports", "लैब रिपोर्ट", "ল্যাব রিপোর্ট"],
  discharge: ["Discharge", "डिस्चार्ज", "ডিসচার্জ"],
  other: ["Other", "अन्य", "অন্যান্য"],
  noReports: ["No reports found", "कोई रिपोर्ट नहीं मिली", "কোনো রিপোর্ট পাওয়া যায়নি"],
  uploadAReport: ["Upload a report", "रिपोर्ट अपलोड करें", "রিপোর্ট আপলোড করুন"],
  // report detail
  aiAnalysis: ["AI Analysis", "AI विश्लेषण", "AI বিশ্লেষণ"],
  simpleExplanation: ["Simple Explanation", "सरल व्याख्या", "সহজ ব্যাখ্যা"],
  aboutCondition: ["About the Condition", "बीमारी के बारे में", "রোগ সম্পর্কে"],
  medicines: ["Medicines", "दवाइयाँ", "ওষুধ"],
  doctorInstructions: ["Doctor Instructions", "डॉक्टर के निर्देश", "ডাক্তারের নির্দেশ"],
  precautions: ["Precautions", "सावधानियाँ", "সতর্কতা"],
  confidence: ["confidence", "विश्वसनीयता", "আস্থা"],
  viewTimeline: ["View Medicine Timeline", "दवा समय-सारणी देखें", "ওষুধের সময়রেখা দেখুন"],
  listen: ["Listen", "सुनें", "শুনুন"],
  stop: ["Stop", "रोकें", "থামুন"],
  // upload
  uploadDesc: ["Capture or upload a prescription, lab report or discharge summary. AI will read it and explain everything in simple language.", "पर्चा, लैब रिपोर्ट या डिस्चार्ज सारांश कैप्चर या अपलोड करें। AI इसे पढ़कर सरल भाषा में समझाएगा।", "প্রেসক্রিপশন, ল্যাব রিপোর্ট বা ডিসচার্জ সারাংশ ক্যাপচার বা আপলোড করুন। AI সহজ ভাষায় ব্যাখ্যা করবে।"],
  cameraCapture: ["Camera Capture", "कैमरा से स्कैन", "ক্যামেরা ক্যাপচার"],
  cameraSub: ["Scan the document directly", "दस्तावेज़ सीधे स्कैन करें", "সরাসরি নথি স্ক্যান করুন"],
  gallery: ["Choose from Gallery", "गैलरी से चुनें", "গ্যালারি থেকে বাছুন"],
  gallerySub: ["PNG or JPEG photos", "PNG या JPEG फ़ोटो", "PNG বা JPEG ছবি"],
  analyzeWithAI: ["Analyze with AI", "AI से विश्लेषण करें", "AI দিয়ে বিশ্লেষণ"],
  chooseDifferent: ["Choose different image", "दूसरी छवि चुनें", "অন্য ছবি বাছুন"],
  readingDoc: ["AI is reading your document…", "AI आपका दस्तावेज़ पढ़ रहा है…", "AI আপনার নথি পড়ছে…"],
  readingDocSub: ["Extracting text, detecting medicines and preparing a simple explanation. Takes ~10-20 seconds.", "टेक्स्ट निकाला जा रहा है, दवाएँ पहचानी जा रही हैं। ~10-20 सेकंड लगेंगे।", "টেক্সট বের করা হচ্ছে, ওষুধ শনাক্ত হচ্ছে। ~১০-২০ সেকেন্ড লাগবে।"],
  retryAnalysis: ["Retry Analysis", "फिर से विश्लेषण करें", "আবার বিশ্লেষণ করুন"],
  retakePhoto: ["Retake photo", "फिर से फ़ोटो लें", "আবার ছবি তুলুন"],
  // profile
  profile: ["Profile", "प्रोफ़ाइल", "প্রোফাইল"],
  preferences: ["PREFERENCES", "प्राथमिकताएँ", "পছন্দসমূহ"],
  darkMode: ["Dark Mode", "डार्क मोड", "ডার্ক মোড"],
  language: ["Language", "भाषा", "ভাষা"],
  health: ["HEALTH", "स्वास्थ्य", "স্বাস্থ্য"],
  emergencyCard: ["Emergency Card", "आपातकालीन कार्ड", "জরুরি কার্ড"],
  uploadNew: ["Upload New Report", "नई रिपोर्ट अपलोड करें", "নতুন রিপোর্ট আপলোড"],
  healthAnalytics: ["Health Analytics", "स्वास्थ्य विश्लेषण", "স্বাস্থ্য বিশ্লেষণ"],
  about: ["ABOUT", "जानकारी", "সম্পর্কে"],
  aboutText: ["MediGuide AI is an educational assistant. It never diagnoses diseases or prescribes medicines. Always consult a qualified healthcare professional for medical decisions.", "MediGuide AI एक शैक्षिक सहायक है। यह कभी रोग निदान या दवा निर्धारित नहीं करता। चिकित्सा निर्णयों के लिए हमेशा योग्य डॉक्टर से परामर्श करें।", "MediGuide AI একটি শিক্ষামূলক সহকারী। এটি কখনো রোগ নির্ণয় বা ওষুধ নির্ধারণ করে না। চিকিৎসা সিদ্ধান্তের জন্য সবসময় যোগ্য ডাক্তারের পরামর্শ নিন।"],
  signOut: ["Sign Out", "साइन आउट", "সাইন আউট"],
  // analytics
  adherence7d: ["7-Day Adherence", "7-दिन दवा पालन", "৭-দিনের মেনে চলা"],
  monthlyUploads: ["Monthly Uploads", "मासिक अपलोड", "মাসিক আপলোড"],
  bloodPressure: ["Blood Pressure", "रक्तचाप", "রক্তচাপ"],
  sugar: ["Blood Sugar", "रक्त शर्करा", "রক্তে শর্করা"],
  weight: ["Weight", "वज़न", "ওজন"],
  addReading: ["Add Reading", "रीडिंग जोड़ें", "রিডিং যোগ করুন"],
  noVitals: ["No readings yet. Add your first reading below.", "अभी कोई रीडिंग नहीं। नीचे पहली रीडिंग जोड़ें।", "এখনো কোনো রিডিং নেই। নিচে প্রথম রিডিং যোগ করুন।"],
  save: ["Save", "सहेजें", "সংরক্ষণ"],
  systolic: ["Systolic", "सिस्टोलिक", "সিস্টোলিক"],
  diastolic: ["Diastolic", "डायस्टोलिक", "ডায়াস্টোলিক"],
  sugarValue: ["Sugar (mg/dL)", "शर्करा (mg/dL)", "শর্করা (mg/dL)"],
  weightValue: ["Weight (kg)", "वज़न (kg)", "ওজন (kg)"],
  overallAdherence: ["Overall adherence", "कुल पालन", "সামগ্রিক মেনে চলা"],
  readingSaved: ["Reading saved", "रीडिंग सहेजी गई", "রিডিং সংরক্ষিত"],
};

const idx: Record<Lang, number> = { en: 0, hi: 1, bn: 2 };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof D) => string;
  speechLocale: string;
}

const I18nContext = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => D[k]?.[0] ?? String(k),
  speechLocale: "en-US",
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    storage.getItem("app_language", "en").then((l) => {
      if (l === "en" || l === "hi" || l === "bn") setLangState(l);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    storage.setItem("app_language", l);
  };

  const t = (key: keyof typeof D) => D[key]?.[idx[lang]] ?? D[key]?.[0] ?? String(key);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, speechLocale: SPEECH_LOCALES[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
