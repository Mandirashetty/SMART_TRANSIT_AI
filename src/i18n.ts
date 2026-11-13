import { LangCode } from './types';

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'EN' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
];

export const TRANSLATIONS: Record<
  LangCode,
  {
    appTitle: string;
    navCrisis: string;
    navLiveMap: string;
    navRouteRescue: string;
    navParentRide: string;
    navFleetAlerts: string;
    navAnalytics: string;
    navAssistant: string;
    navVideoStudio: string;
    navSosAdmin: string;
    navAccount: string;
    sosButton: string;
    simulatedBadge: string;
    headingCrisis: string;
    headingLiveMap: string;
    headingRouteRescue: string;
    headingParentRide: string;
    headingFleetAlerts: string;
    headingAnalytics: string;
    headingAssistant: string;
    headingVideoStudio: string;
    headingSosAdmin: string;
    headingAccount: string;
    triggerCrisis: string;
    resetCrisis: string;
    beforeLabel: string;
    afterLabel: string;
    examCountdown: string;
  }
> = {
  en: {
    appTitle: 'SmartTransit AI',
    navCrisis: 'Crisis Command',
    navLiveMap: 'Live Tracking',
    navRouteRescue: 'RouteRescue AI',
    navParentRide: 'ParentRide',
    navFleetAlerts: 'Bus Fleet & Alerts',
    navAnalytics: 'Demand Analytics',
    navAssistant: 'AI Assistant',
    navVideoStudio: 'AI Video Studio',
    navSosAdmin: 'SOS Dashboard',
    navAccount: 'Auth & Roles',
    sosButton: 'Emergency SOS',
    simulatedBadge: 'SIMULATED TELEMETRY',
    headingCrisis: 'Exam-Day Crisis Command Center',
    headingLiveMap: 'Live Rural Fleet Tracking & Road Network',
    headingRouteRescue: 'RouteRescue AI Multi-Modal Recommender',
    headingParentRide: 'ParentRide Verified Carpool Network',
    headingFleetAlerts: 'Bus Details & Smart Dispatch Alerts',
    headingAnalytics: 'Village Demand & Capacity Forecast Analytics',
    headingAssistant: 'Database-Grounded Transit AI Assistant',
    headingVideoStudio: 'SmartTransit AI Explainer Video Studio',
    headingSosAdmin: 'Emergency SOS Incident Dashboard',
    headingAccount: 'User Authentication & Role Access',
    triggerCrisis: 'TRIGGER EXAM-DAY CRISIS',
    resetCrisis: 'RESET CRISIS',
    beforeLabel: 'BEFORE CRISIS (Baseline)',
    afterLabel: 'AFTER CRISIS (Orchestrated)',
    examCountdown: 'Exam Window Countdown',
  },
  kn: {
    appTitle: 'ಸ್ಮಾರ್ಟ್‌ಟ್ರಾನ್ಸಿಟ್ AI',
    navCrisis: 'ತುರ್ತು ಕಮಾಂಡ್',
    navLiveMap: 'ಲೈವ್ ಟ್ರ್ಯಾಕಿಂಗ್',
    navRouteRescue: 'ರೂಟ್‌ರೆಸ್ಕ್ಯೂ AI',
    navParentRide: 'ಪೇರೆಂಟ್‌ರೈಡ್',
    navFleetAlerts: 'ಬಸ್ ಮತ್ತು ಎಚ್ಚರಿಕೆ',
    navAnalytics: 'ಬೇಡಿಕೆ ವಿಶ್ಲೇಷಣೆ',
    navAssistant: 'AI ಸಹಾಯಕ',
    navVideoStudio: 'AI ವೀಡಿಯೊ ಸ್ಟುಡಿಯೋ',
    navSosAdmin: 'SOS ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    navAccount: 'ಖಾತೆ ಮತ್ತು ಪಾತ್ರಗಳು',
    sosButton: 'ತುರ್ತು SOS',
    simulatedBadge: 'ಅನುಕರಿಸಿದ ಡೇಟಾ',
    headingCrisis: 'ಪರೀಕ್ಷಾ ದಿನದ ತುರ್ತು ನಿಯಂತ್ರಣ ಕೇಂದ್ರ',
    headingLiveMap: 'ಲೈವ್ ಗ್ರಾಮೀಣ ಬಸ್ ಟ್ರ್ಯಾಕಿಂಗ್ ಮತ್ತು ರಸ್ತೆ ನಕ್ಷೆ',
    headingRouteRescue: 'ರೂಟ್‌ರೆಸ್ಕ್ಯೂ AI ಪರ್ಯಾಯ ಮಾರ್ಗ ಸಲಹೆ',
    headingParentRide: 'ಪೇರೆಂಟ್‌ರೈಡ್ ಪೋಷಕರ ವಾಹನ ಹಂಚಿಕೆ',
    headingFleetAlerts: 'ಬಸ್ ವಿವರಗಳು ಮತ್ತು ಸ್ಮಾರ್ಟ್ ಎಚ್ಚರಿಕೆಗಳು',
    headingAnalytics: 'ಗ್ರಾಮೀಣ ಬೇಡಿಕೆ ಮತ್ತು ಸಾಮರ್ಥ್ಯ ವಿಶ್ಲೇಷಣೆ',
    headingAssistant: 'ಡೇಟಾಬೇಸ್ ಆಧಾರಿತ AI ಸಾರಿಗೆ ಸಹಾಯಕ',
    headingVideoStudio: 'ಸ್ಮಾರ್ಟ್‌ಟ್ರಾನ್ಸಿಟ್ AI ವೀಡಿಯೊ ಸ್ಟುಡಿಯೋ',
    headingSosAdmin: 'ತುರ್ತು SOS ವರದಿಗಳ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    headingAccount: 'ಬಳಕೆದಾರರ ಲಾಗಿನ್ ಮತ್ತು ಪಾತ್ರ ಪ್ರವೇಶ',
    triggerCrisis: 'ಪರೀಕ್ಷಾ ತುರ್ತು ಸ್ಥಿತಿ ಪ್ರಾರಂಭಿಸಿ',
    resetCrisis: 'ತುರ್ತು ಸ್ಥಿತಿ ಮರುಹೊಂದಿಸಿ',
    beforeLabel: 'ತುರ್ತು ಸ್ಥಿತಿಗೆ ಮೊದಲು',
    afterLabel: 'ತುರ್ತು ಸ್ಥಿತಿಯ ನಂತರ (ಪುನರ್‌ನಿರ್ದೇಶಿತ)',
    examCountdown: 'ಪರೀಕ್ಷಾ ಸಮಯದ ಎಣಿಕೆ',
  },
  hi: {
    appTitle: 'स्मार्टट्रांजिट AI',
    navCrisis: 'संकट कमांड केंद्र',
    navLiveMap: 'लाइव बस ट्रैकिंग',
    navRouteRescue: 'रूटरेस्क्यू AI',
    navParentRide: 'पेरेंटराइड',
    navFleetAlerts: 'बस विवरण व अलर्ट',
    navAnalytics: 'मांग विश्लेषण',
    navAssistant: 'AI सहायक',
    navVideoStudio: 'AI वीडियो स्टूडियो',
    navSosAdmin: 'SOS डैशबोर्ड',
    navAccount: 'लॉगिन व भूमिकाएं',
    sosButton: 'आपातकालीन SOS',
    simulatedBadge: 'सिम्युलेटेड डेटा',
    headingCrisis: 'परीक्षा-दिवस संकट प्रबंधन कमांड सेंटर',
    headingLiveMap: 'लाइव ग्रामीण बस ट्रैकिंग और सड़क नेटवर्क',
    headingRouteRescue: 'रूटरेस्क्यू AI वैकल्पिक मार्ग अनुशंसा',
    headingParentRide: 'पेरेंटराइड सत्यापित कारपूल नेटवर्क',
    headingFleetAlerts: 'बस विवरण और स्मार्ट अलर्ट प्रणाली',
    headingAnalytics: 'ग्रामीण परिवहन मांग और क्षमता पूर्वानुमान',
    headingAssistant: 'डेटाबेस-आधारित AI परिवहन सहायक',
    headingVideoStudio: 'स्मार्टट्रांजिट AI प्रस्तुति वीडियो स्टूडियो',
    headingSosAdmin: 'आपातकालीन SOS घटना डैशबोर्ड',
    headingAccount: 'उपयोगकर्ता प्रमाणीकरण और भूमिकाएं',
    triggerCrisis: 'परीक्षा संकट सक्रिय करें',
    resetCrisis: 'संकट रीसेट करें',
    beforeLabel: 'संकट से पहले (बेसलाइन)',
    afterLabel: 'संकट के बाद (पुनर्व्यवस्थित)',
    examCountdown: 'परीक्षा समय उलटी गिनती',
  },
  ta: {
    appTitle: 'ஸ்மார்ட் டிரான்சிட் AI',
    navCrisis: 'நெருக்கடி கட்டளை',
    navLiveMap: 'நேரடி கண்காணிப்பு',
    navRouteRescue: 'ரூட்ரெஸ்க்யூ AI',
    navParentRide: 'பேரண்ட்ரைடு',
    navFleetAlerts: 'பேருந்து & எச்சரிக்கை',
    navAnalytics: 'தேவை பகுப்பாய்வு',
    navAssistant: 'AI உதவியாளர்',
    navVideoStudio: 'AI வீடியோ ஸ்டுடியோ',
    navSosAdmin: 'SOS டாஷ்போர்டு',
    navAccount: 'உள்நுழைவு & பங்குகள்',
    sosButton: 'அவசர SOS',
    simulatedBadge: 'உருவகப்படுத்தப்பட்ட தரவு',
    headingCrisis: 'தேர்வு-நாள் நெருக்கடி மேலாண்மை மையம்',
    headingLiveMap: 'நேரடி கிராமப்புற பேருந்து கண்காணிப்பு',
    headingRouteRescue: 'ரூட்ரெஸ்க்யூ AI மாற்று வழி பரிந்துரை',
    headingParentRide: 'பேரண்ட்ரைடு பெற்றோர் வாகனப் பகிர்வு',
    headingFleetAlerts: 'பேருந்து விவரங்கள் மற்றும் ஸ்மார்ட் எச்சரிக்கைகள்',
    headingAnalytics: 'கிராமப்புற போக்குவரத்து தேவை பகுப்பாய்வு',
    headingAssistant: 'தரவுத்தள AI போக்குவரத்து உதவியாளர்',
    headingVideoStudio: 'ஸ்மார்ட் டிரான்சிட் AI வீடியோ ஸ்டுடியோ',
    headingSosAdmin: 'அவசர SOS நிகழ்வு டாஷ்போர்டு',
    headingAccount: 'பயனர் அங்கீகாரம் & அணுகல்',
    triggerCrisis: 'தேர்வு நெருக்கடியைத் தொடங்கு',
    resetCrisis: 'நெருக்கடியை மீட்டமை',
    beforeLabel: 'நெருக்கடிக்கு முன்',
    afterLabel: 'நெருக்கடிக்குப் பின் (மாற்று வழி)',
    examCountdown: 'தேர்வு நேர கவுண்டவுன்',
  },
};
