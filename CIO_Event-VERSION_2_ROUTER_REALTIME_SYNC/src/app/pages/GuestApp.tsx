import { useState, useEffect } from "react";
import { WelcomeScreen } from "../components/WelcomeScreen";
import { CameraScreen } from "../components/CameraScreen";
import { SuccessScreen } from "../components/SuccessScreen";
import { DashboardScreen } from "../components/DashboardScreen";
import { QuestionScreen } from "../components/QuestionScreen";
import { NotificationModal } from "../components/NotificationModal";
import { type Attendee } from "../utils/database";
import { supabase, PRESENCE_CHANNEL } from "../utils/supabaseClient";

type Screen = "welcome" | "camera" | "success" | "dashboard" | "question";

export function GuestApp() {

  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");

  const [attendee, setAttendee] = useState<Attendee | null>(() => {
    const saved = localStorage.getItem("checkedInAttendee");
    return saved ? JSON.parse(saved) : null;
  });

  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const handleCheckIn = () => {
    setCurrentScreen("camera");
  };

  const handleAuthSuccess = (att: Attendee) => {
    setAttendee(att);
    localStorage.setItem("checkedInAttendee", JSON.stringify(att));

    // Track presence
    const channel = supabase.channel(PRESENCE_CHANNEL);
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: att.name,
          online_at: new Date().toISOString(),
        });
      }
    });

    // ✅ go to success screen first
    setCurrentScreen("success");
  };

  const handleContinueToDashboard = () => {
    // ✅ only here go to dashboard
    setCurrentScreen("dashboard");
  };

  const handleQuestionClick = () => {
    setCurrentScreen("question");
  };

  const handleBackToDashboard = () => {
    setCurrentScreen("dashboard");
  };

  const handleNotificationClick = () => {
    setShowNotifications(true);
  };

  const handleViewQuestion = () => {
    setShowNotifications(false);
    setCurrentScreen("question");
  };

  return (
    <div className="size-full">

      {currentScreen === "welcome" && (
        <WelcomeScreen onCheckIn={handleCheckIn} />
      )}

      {currentScreen === "camera" && (
        <CameraScreen onSuccess={handleAuthSuccess} />
      )}

      {currentScreen === "success" && attendee && (
        <SuccessScreen
          attendee={attendee}
          onContinue={handleContinueToDashboard}
        />
      )}

      {currentScreen === "dashboard" && (
        <DashboardScreen
          name={attendee?.name || "Guest"}
          onQuestionClick={handleQuestionClick}
          onNotificationClick={handleNotificationClick}
        />
      )}

      {currentScreen === "question" && (
        <QuestionScreen onBack={handleBackToDashboard} />
      )}

      <NotificationModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onViewQuestion={handleViewQuestion}
      />

    </div>
  );
}
