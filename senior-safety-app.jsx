import React, { useState, useEffect, useRef } from "react";
import { Phone, Camera, ShieldAlert, KeyRound, BookOpen, ArrowLeft, Check, X, Mail, CreditCard, Bitcoin, UserX, PhoneCall, Settings, MessageCircle, MapPin, Loader } from "lucide-react";
import styles from "./senior-safety-app.module.css";

const COLOR_MAP = { navy: styles.bgNavy, green: styles.bgGreen, red: styles.bgRed, grey: styles.bgGrey };

const STORE_KEY = "senior-safety-settings";

// ---------- Phone helpers ----------
function cleanPhone(phone) {
  return (phone || "").replace(/[^0-9+]/g, "");
}
function telHref(phone) {
  return `tel:${cleanPhone(phone)}`;
}
function smsHref(phone, body) {
  // "?&" after the number works reliably across iOS and Android for prefilling a message body.
  return `sms:${cleanPhone(phone)}?&body=${encodeURIComponent(body)}`;
}

// This is the base URL for your future backend server.
// For local testing, it points to the server we just created.
// When you deploy your backend, you will change this to your live server URL.
const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

function useSettings() {
  const [settings, setSettings] = useState({ loaded: false, seniorName: "", trustedName: "", trustedPhone: "", safeWord: "" });

  useEffect(() => {
    // Get the unique profile ID from the URL, e.g., /profile/123xyz
    const pathParts = window.location.pathname.split("/");
    const profileId = pathParts[pathParts.length - 1];

    // If there's no ID in the URL, we can't load or save data.
    if (!profileId || pathParts.length < 3) {
      console.error("No profile ID in URL. Cannot load settings.");
      // In a real app, you might show an error page here.
      setSettings({ loaded: true, error: "Invalid Link" });
      return;
    }

    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/profile/${profileId}`);
        if (response.status === 404) {
          // Profile not found, this is a new user.
          setSettings({ loaded: true, profileId });
        } else if (response.ok) {
          // Profile found, load the data.
          const data = await response.json();
          setSettings({ ...data, loaded: true, profileId });
        } else {
          // Some other server error occurred.
          throw new Error(`Server error: ${response.statusText}`);
        }
      } catch (e) {
        // This happens if the server is down or there's a network issue.
        console.error("Failed to load settings:", e);
        setSettings({ loaded: true, error: "Could not connect to service." });
      }
    })();
  }, []);

  const save = async (next) => {    const profileId = settings.profileId;
    if (!profileId) return; // Can't save without an ID

    try {
      const response = await fetch(`${API_BASE_URL}/profile/${profileId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });

      if (!response.ok) {
        // Make sure we throw an error if the server response isn't successful.
        throw new Error(`Server responded with status: ${response.status}`);
      }

      setSettings({ ...settings, ...next });
    } catch (e) {
      console.error("Could not save settings", e);
      // Re-throw the error so the UI component can catch it and show a message.
      throw e;
    }
  };

  const deleteProfile = async () => {
    const profileId = settings.profileId;
    if (!profileId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/profile/${profileId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      // On successful deletion, reload the page to clear all state
      // and start fresh from the setup screen.
      window.location.reload();
    } catch (e) {
      console.error("Could not delete profile", e);
      // Re-throw for the UI to handle
      throw e;
    }
  };

  return [settings, save, deleteProfile];
}

// ---------- Shared UI ----------
const BigButton = React.forwardRef(({ icon: Icon, label, sub, color = "navy", onClick, big = true, as: Component = "button", ...props }, ref) => {
  const colorClass = COLOR_MAP[color] || styles.bgNavy;
  return (
    <Component
      ref={ref}
      onClick={onClick}
      className={`${styles.bigButton} ${colorClass} ${!big ? styles.small : ''}`}
      {...props}
    >
      <div className={styles.bigButtonIcon}>
        <Icon size={34} strokeWidth={2.2} />
      </div>
      <div>
        <div className={styles.bigButtonLabel}>{label}</div>
        {sub && <div className={styles.bigButtonSub}>{sub}</div>}
      </div>
    </Component>
  );
});
BigButton.displayName = "BigButton";

function TopBar({ title, onBack }) {
  return (
    <div className={styles.topBar}>
      {onBack && (
        <button onClick={onBack} aria-label="Go back" className={styles.backButton}>
          <ArrowLeft color="#fff" size={26} />
        </button>
      )}
      <h1>{title}</h1>
    </div>
  );
}

function Screen({ children }) {
  return (
    <div
      className={styles.screen}>
      {children}
    </div>
  );
}

function Modal({ isOpen, onClose, title, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>{title}</h2>
        <div>{children}</div>
      </div>
    </div>
  );
}

// ---------- Setup ----------
function SetupScreen({ settings, save, onDone, deleteProfile }) {
  const [seniorName, setSeniorName] = useState(settings.seniorName || "");
  const [trustedName, setTrustedName] = useState(settings.trustedName || "");
  const [trustedPhone, setTrustedPhone] = useState(settings.trustedPhone || "");
  const [safeWord, setSafeWord] = useState(settings.safeWord || "");
  const [notes, setNotes] = useState(settings.notes || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  return (
    <Screen>
      <TopBar title="Set Up" />

      <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete All Data?">
        <p>This will permanently delete your profile, including your name, trusted contact, and all other saved information.</p>
        <p><strong>This action cannot be undone.</strong></p>
        <div className={styles.modalActions}>
          <BigButton
            label={isDeleting ? "Deleting..." : "Yes, Delete Everything"}
            color="red"
            disabled={isDeleting}
            onClick={async () => {
              setIsDeleting(true);
              setDeleteError(null);
              try {
                await deleteProfile();
                // window reloads on success, so no need to setIsDeleting(false)
              } catch (error) {
                setDeleteError("Could not delete data. Please try again later.");
                setIsDeleting(false);
                setDeleteModalOpen(false); // Close modal on error to show the message
              }
            }}
          />
          <BigButton label="Cancel" color="grey" onClick={() => setDeleteModalOpen(false)} />
        </div>
      </Modal>

      <p className={styles.p}>Fill this in once. A family member can help.</p>

      <label className={styles.formLabel} htmlFor="seniorName">Your name</label>
      <input id="seniorName" className={styles.formInput} value={seniorName} onChange={(e) => setSeniorName(e.target.value)} placeholder="e.g. Rose" />

      <label className={styles.formLabel} htmlFor="trustedName">Trusted person's name</label>
      <input id="trustedName" className={styles.formInput} value={trustedName} onChange={(e) => setTrustedName(e.target.value)} placeholder="e.g. Daniel (son)" />

      <label className={styles.formLabel} htmlFor="trustedPhone">Trusted person's phone number</label>
      <input
        id="trustedPhone"
        className={styles.formInput}
        value={trustedPhone}
        onChange={(e) => setTrustedPhone(e.target.value)}
        placeholder="e.g. 555-123-4567"
        type="tel"
      />

      <label className={styles.formLabel} htmlFor="safeWord">Family safe word (optional)</label>
      <p className={styles.formHelpText}>
        A private word only your family knows. If someone calls claiming to be a relative in trouble, ask for this word.
      </p>
      <input id="safeWord" className={styles.formInput} value={safeWord} onChange={(e) => setSafeWord(e.target.value)} placeholder="e.g. sunflower" />

      <label className={styles.formLabel} htmlFor="notes">My Notes (private)</label>
      <p className={styles.formHelpText}>
        A private place to jot down notes, like reference numbers or suspicious phone numbers.
      </p>
      <textarea
        id="notes"
        className={styles.formInput}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g., Called from 555-867-5309, reference #ABC123..."
        rows={4}
      ></textarea>

      <BigButton
        icon={Check}
        label={isSaving ? "Saving..." : "Save"}
        color="green"
        disabled={isSaving}
        onClick={async () => {
          setIsSaving(true);
          setSaveError(null);
          try {
            await save({ seniorName, trustedName, trustedPhone, safeWord, notes });
            onDone();
          } catch (error) {
            setSaveError("Could not save settings. Please check your connection and try again.");
          } finally {
            setIsSaving(false);
          }
        }}
      />
      {saveError && (
        <p className={styles.errorText}>{saveError}</p>
      )}

      <div style={{ marginTop: 30, borderTop: '1px solid var(--color-light-grey)', paddingTop: 20 }}>
        <BigButton
          icon={X}
          label="Delete My Data"
          color="red"
          onClick={() => setDeleteModalOpen(true)}
        />
        {deleteError && (
          <p className={styles.errorText} style={{ marginTop: 10 }}>{deleteError}</p>
        )}
      </div>
    </Screen>
  );
}

// ---------- Home ----------
function HomeScreen({ settings, nav }) {
  return (
    <Screen>
      <div className={styles.homeHeader}>
        <div className={styles.homeIconWrapper}>
          <ShieldAlert color="var(--color-amber)" size={44} />
        </div>
        <h1 className={styles.homeTitle}>
          {settings.seniorName ? `Hi, ${settings.seniorName}` : "TrustPause"}
        </h1>
        <p className={styles.homeSubtitle}>What do you want to do?</p>
      </div>

      <div style={{ marginTop: 22 }}>
        <BigButton
          icon={PhoneCall}
          label="Call or Text Trusted Person"
          sub={settings.trustedName ? settings.trustedName : "Not set up yet"}
          color="green"
          onClick={() => nav("call")}
        />
        <BigButton
          icon={Camera}
          label="Take a Picture to Share"
          sub="Mail, a letter, a text message"
          onClick={() => nav("photo")}
        />
        <BigButton
          icon={ShieldAlert}
          label="I Got a Call or Message"
          sub="Check if it might be a scam"
          color="red"
          onClick={() => nav("checklist")}
        />
        <BigButton
          icon={KeyRound}
          label="Check the Safe Word"
          sub="For calls about family in trouble"
          color="navy"
          onClick={() => nav("safeword")}
        />
        <BigButton
          icon={BookOpen}
          label="Learn About Scams"
          color="navy"
          onClick={() => nav("learn")}
        />
        <BigButton
          icon={Settings}
          label="Settings"
          big={false}
          color="grey"
          onClick={() => nav("setup")}
        />
      </div>
    </Screen>
  );
}

// ---------- Call trusted person ----------
function CallScreen({ settings, onBack }) {
  const hasContact = settings.trustedPhone;
  const [locationStatus, setLocationStatus] = useState("idle"); // idle, loading, error, success
  const [locationLink, setLocationLink] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const defaultText = `Hi ${settings.trustedName || ""}, this is ${
    settings.seniorName || "me"
  }. Can you call me when you get a chance? I want to check something before I do anything.`;

  return (
    <Screen>
      <TopBar title="Reach Trusted Person" onBack={onBack} />

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Share Location?">
        <p>This will get your current location and prepare a text message for {settings.trustedName}.</p>
        <p>Are you sure you want to do this?</p>
        <div className={styles.modalActions}>
          <BigButton label="Yes, Share" color="green" onClick={() => {
            setModalOpen(false);
            proceedWithLocationShare();
          }} />
          <BigButton label="Cancel" color="grey" onClick={() => setModalOpen(false)} />
        </div>
      </Modal>

      {hasContact ? (
        <>
          <div className={styles.contactCard}>
            <div className={styles.contactName}>{settings.trustedName}</div>
            <div className={styles.contactPhone}>{settings.trustedPhone}</div>
          </div>
          <BigButton as="a" href={telHref(settings.trustedPhone)} icon={Phone} label={`Call ${settings.trustedName}`} color="green" />
          <BigButton as="a" href={smsHref(settings.trustedPhone, defaultText)} icon={MessageCircle} label={`Text ${settings.trustedName}`} color="navy" />

          {locationStatus === "success" ? (
            <BigButton
              as="a"
              href={locationLink}
              icon={Check}
              label="Location Ready! Tap to Text"
              color="green"
            />
          ) : (
            <BigButton
              icon={locationStatus === 'loading' ? Loader : MapPin}
              label={locationStatus === 'loading' ? "Getting Location..." : "Share My Location"}
              color="navy"
              onClick={() => setModalOpen(true)}
              disabled={locationStatus === 'loading'}
            />
          )}

          <p className={styles.infoText}>
            Both buttons open your phone's own Phone or Messages app — nothing is sent from inside this app.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 20 }}>No trusted person saved yet. Go to Settings to add one.</p>
      )}
    </Screen>
  );

  function proceedWithLocationShare() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        const body = `Hi ${settings.trustedName || "there"}, this is ${settings.seniorName || "me"}. Here is my current location: ${mapsLink}`;
        setLocationLink(smsHref(settings.trustedPhone, body));
        setLocationStatus("success");
      },
      () => setLocationStatus("error")
    );
  }
}

// ---------- Photo share ----------
function PhotoScreen({ settings, onBack }) {
  const fileRef = useRef(null);
  const retakeButtonRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null); // null, 'ai', or 'real'
  const [analysisError, setAnalysisError] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(file);
    setPhotoUrl(URL.createObjectURL(file));
    setSaved(false);
    setShareMsg("");
    setAnalysisResult(null);
    setAnalysisError(null);
    setTimeout(() => {
      retakeButtonRef.current?.focus();
    }, 100);
  };

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const handleAnalyzeImage = async () => {
    if (!photo) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    try {
      const formData = new FormData();
      formData.append("image", photo);

      const response = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }
      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result.score > 0.9 ? "ai" : "real"); // 90% threshold
      } else {
        // Handle cases where the API call is successful but the analysis isn't
        throw new Error(result.error || "Analysis request was not successful.");
      }
    } catch (e) {
      console.error("Analysis failed", e);
      setAnalysisError("Analysis failed. Please check your connection and try again.");
    }
    setIsAnalyzing(false);
  };
  // Web Share (with the actual photo attached) works on some phones but is blocked
  // inside this preview window on many others. Try it, but never rely on it alone —
  // Save + Text below always works because those just hand off to the phone's own apps.
  const tryQuickShare = async () => {
    if (!photo) return;
    const text = `This is from ${settings.seniorName || "me"}. Can you look at this before I respond to anything?`;
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [photo] })) {
        await navigator.share({ files: [photo], text, title: "Please take a look" });
        setShareMsg("Sent. Wait to hear back before doing anything else.");
        return;
      }
    } catch (e) {
      // fall through to manual steps below — this is expected on many phones/browsers
    }
    setShareMsg("");
  };

  const textHref = smsHref(
    settings.trustedPhone,
    `Hi ${settings.trustedName || ""}, this is ${settings.seniorName || "me"}. I just saved a picture to my phone — one second, attaching it now.`
  );

  return (
    <Screen>
      <TopBar title="Take a Picture" onBack={onBack} />
      <p style={{ fontSize: 19, color: 'var(--color-ink)', marginBottom: 20 }}>
        Take a picture of the letter, text, or email. Send it to {settings.trustedName || "your trusted person"} before you
        do anything it asks.
      </p>

      {photo ? (
        <div style={{ textAlign: "center", marginBottom: 20, }}>
          <img
            src={photoUrl}
            alt="Captured document"
            className={styles.photoPreview}
          />
        </div>
      ) : (
        <div className={styles.photoPlaceholder}>
          <Camera size={48} />
          <div>No picture yet</div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      <BigButton
        ref={retakeButtonRef}
        icon={Camera}
        label={photo ? "Retake Picture" : "Open Camera"}
        onClick={() => fileRef.current.click()}
      />

      {photo && (
        <>
          <BigButton
            icon={isAnalyzing ? Loader : Check}
            label={isAnalyzing ? "Analyzing..." : "Analyze for AI"}
            onClick={handleAnalyzeImage}
            disabled={isAnalyzing}
            color="navy"
          />
          {analysisError && (
            <p className={styles.errorText} style={{ textAlign: 'center', marginBottom: 10 }}>{analysisError}</p>
          )}
          {analysisResult && (
            <div className={analysisResult === 'ai' ? styles.warningBox : styles.successBox}>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Analysis Complete</div>
              {analysisResult === 'ai'
                ? "This image is LIKELY AI-GENERATED. Be very cautious."
                : "This image appears to be a REAL PHOTOGRAPH."
              }
            </div>
          )}

          <div className={styles.stepHeader}>
            Step 1: Save the picture
          </div>
          <BigButton
            as="a"
            href={photoUrl}
            download={`photo-for-${(settings.trustedName || "trusted-person").replace(/\s+/g, "-")}.jpg`}
            onClick={() => setSaved(true)}
            icon={Check}
            label="Save Picture to My Phone"
            color="navy"
          />

          <div className={styles.stepHeader}>
            Step 2: Text it to {settings.trustedName || "your trusted person"}
          </div>
          <BigButton
            as="a"
            href={textHref}
            icon={MessageCircle}
            label={`Open Text to ${settings.trustedName || "Trusted Person"}`}
            color="green"
          />
          <p style={{ fontSize: 16, color: "#555", marginBottom: 20 }}>
            This opens Messages with the text ready. Tap the photo/paperclip button in Messages and attach the picture you
            just saved.
          </p>

          {navigator.share && (
            <BigButton icon={PhoneCall} label="Or Try One-Tap Share" big={false} onClick={tryQuickShare} />
          )}
          {shareMsg && (
            <p style={{ fontSize: 17, background: "#fff", padding: 16, borderRadius: 14, color: 'var(--color-ink)', marginTop: 10 }}>
              {shareMsg}
            </p>
          )}
        </>
      )}
    </Screen>
  );
}

// ---------- Scam checklist ----------
const CHECK_ITEMS = [
  { key: "giftcard", label: "Asked you to buy gift cards", icon: CreditCard },
  { key: "wire", label: "Asked you to wire money or send crypto", icon: Bitcoin },
  { key: "secret", label: "Told you to keep it a secret from family", icon: UserX },
  { key: "urgent", label: "Said you must act right now", icon: ShieldAlert },
  { key: "someone-else", label: "Claimed to be a relative, the bank, or the government", icon: Mail },
];

function ChecklistScreen({ settings, onBack, nav }) {
  const [checked, setChecked] = useState({});
  const anyChecked = Object.values(checked).some(Boolean);

  return (
    <Screen>
      <TopBar title="Check This Call" onBack={onBack} />
      <p style={{ fontSize: 19, marginBottom: 18 }}>Did the person on the phone or in the message do any of these?</p>

      {CHECK_ITEMS.map((item) => {
        const isChecked = !!checked[item.key];
        return (
          <button
            key={item.key}
            onClick={() => setChecked((c) => ({ ...c, [item.key]: !c[item.key] }))}
            className={`${styles.checklistItem} ${isChecked ? styles.checked : ''}`}>
            <item.icon size={28} />
            {item.label}
          </button>
        );
      })}

      {anyChecked && (
        <div className={styles.warningBox}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>Stop. Don't send anything yet.</div>
          <div style={{ fontSize: 17 }}>
            This matches how real scams work. Real family, banks, and government agencies never ask for gift cards or
            crypto, and never demand total secrecy. Call your trusted person before doing anything else.
          </div>
        </div>
      )}

      <BigButton icon={PhoneCall} label={`Call or Text ${settings.trustedName || "Trusted Person"} Now`} color="green" onClick={() => nav("call")} />
    </Screen>
  );
}

// ---------- Safe word ----------
function SafeWordScreen({ settings, onBack }) {
  const [reveal, setReveal] = useState(false);
  return (
    <Screen>
      <TopBar title="Safe Word" onBack={onBack} />
      <p style={{ fontSize: 19, marginBottom: 18 }}>
        If someone calls saying a family member is in trouble and needs money right away, ask them for your family's
        safe word first. A stranger won't know it.
      </p>
      {settings.safeWord ? (
        reveal ? (
          <div className={styles.contactCard} style={{ fontSize: 30, fontWeight: 900, color: 'var(--color-navy)' }}>
            {settings.safeWord}
          </div>
        ) : (
          <BigButton icon={KeyRound} label="Show Safe Word" onClick={() => setReveal(true)} />
        )
      ) : (
        <p style={{ fontSize: 18 }}>No safe word saved yet. Add one in Settings with your family.</p>
      )}
      <p style={{ fontSize: 16, color: "#555", marginTop: 10 }}>
        If they don't know it, hang up and call your trusted person yourself using the number you already have.
      </p>
    </Screen>
  );
}

// ---------- Learn about scams ----------
const SCAM_TYPES = [
  {
    key: "mail",
    icon: Mail,
    title: "Fake Mail & Prize Letters",
    body:
      "A letter says you won money or a prize but must pay a 'fee' or 'tax' first to collect it. Real prizes never ask you to pay to receive them.",
  },
  {
    key: "phone",
    icon: PhoneCall,
    title: "Scary Phone Calls",
    body:
      "A caller claims to be the IRS, Social Security, or your bank, and says there's a problem that must be fixed immediately with payment or your personal information. Real agencies contact you by mail first and never demand instant payment over the phone.",
  },
  {
    key: "crypto",
    icon: Bitcoin,
    title: "Crypto & Investment Offers",
    body:
      "Someone promises a guaranteed high return if you send cryptocurrency or move money into an 'investment.' Guaranteed high returns with no risk do not exist.",
  },
  {
    key: "giftcard",
    icon: CreditCard,
    title: "Gift Card Payments",
    body:
      "You're told to pay a bill, fine, or fee using gift cards. No real company, bank, or government office accepts gift cards as payment. This is always a scam.",
  },
  {
    key: "impersonation",
    icon: UserX,
    title: "'It's Me, Grandma' Calls",
    body:
      "A caller sounds like a grandchild or relative in an emergency, asking for money urgently and to keep it secret. Hang up and call that family member back on their known number, or ask for your family's safe word.",
  },
];

function LearnScreen({ onBack }) {
  const [open, setOpen] = useState(null);
  return (
    <Screen>
      <TopBar title="Learn About Scams" onBack={onBack} />
      {SCAM_TYPES.map((s) => (
        <div key={s.key} style={{ marginBottom: 14 }}>
          <button
            onClick={() => setOpen(open === s.key ? null : s.key)}
            aria-expanded={open === s.key}
            className={`${styles.bigButton} ${styles.bgNavy}`}
          >
            <s.icon size={26} />
            {s.title}
          </button>
          {open === s.key && (
            <div className={styles.accordionItem}>
              {s.body}
            </div>
          )}
        </div>
      ))}
    </Screen>
  );
}

// ---------- App ----------
export default function App() {
  const [settings, save, deleteProfile] = useSettings();
  const [screen, setScreen] = useState("home");

  useEffect(() => {
    if (settings.loaded && !settings.error && !settings.trustedPhone) {
      setScreen("setup"); // If no data is loaded, go directly to setup.
    }
  }, [settings.loaded, settings.trustedPhone, settings.error]);

  if (!settings.loaded) {
    return (
      <Screen>
        <p style={{ fontSize: 20, textAlign: 'center' }}>Loading…</p>
      </Screen>
    );
  }
  
  if (settings.error) {
    return (
      <Screen>
        <p style={{ fontSize: 20, textAlign: 'center', color: 'var(--color-red)' }}>Error: {settings.error}. Please check the link.</p>
      </Screen>
    );
  }

  const nav = (s) => setScreen(s);
  const back = () => setScreen("home");

  const screenProps = {
    settings,
    save,
    nav,
    onBack: back,
  };
  switch (screen) {
    case "setup":
      return <SetupScreen settings={settings} save={save} onDone={back} deleteProfile={deleteProfile} />;
    case "call":
      return <CallScreen settings={settings} onBack={back} />;
    case "photo":
      return <PhotoScreen settings={settings} onBack={back} />;
    case "checklist":
      return <ChecklistScreen settings={settings} onBack={back} nav={nav} />;
    case "safeword":
      return <SafeWordScreen settings={settings} onBack={back} />;
    case "learn":
      return <LearnScreen onBack={back} />;
    default:
      return <HomeScreen settings={settings} nav={nav} />;
  }
}
