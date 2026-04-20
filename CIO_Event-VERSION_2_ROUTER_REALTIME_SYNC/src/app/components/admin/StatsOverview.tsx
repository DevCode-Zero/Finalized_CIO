import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Users, UserCheck, Activity, TrendingUp } from "lucide-react";
import { db } from "../../utils/database";
import { supabase, PRESENCE_CHANNEL } from "../../utils/supabaseClient";

export function StatsOverview() {
  const [totalAttendees, setTotalAttendees] = useState(0);
  const [checkedIn, setCheckedIn] = useState(0);
  const [questionsPushed, setQuestionsPushed] = useState(0);
  const [totalResponses, setTotalResponses] = useState(0);
  const [liveUsers, setLiveUsers] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const attendees = await db.getAttendees();
        const questions = await db.getQuestions();
        const responses = await db.getTotalResponses();
        
        console.log("[Stats] Raw data - attendees:", attendees, "questions:", questions, "responses:", responses);
        
        setTotalAttendees(attendees?.length || 0);
        
        // Count all attendees with checked_in_at
        const checkedInCount = attendees?.filter(a => a.checked_in_at).length || 0;
        const questionsSentCount = questions?.filter(q => q.status === "sent").length || 0;
        
        console.log("[Stats] Processed - checkedIn:", checkedInCount, "questionsPushed:", questionsSentCount, "responses:", responses);
        
        setCheckedIn(checkedInCount);
        setQuestionsPushed(questionsSentCount);
        setTotalResponses(responses);
        setLoaded(true);
      } catch (err) {
        console.error("Failed to load stats:", err);
        setLoaded(true);
      }
    };
    
    loadStats();
    
    const interval = setInterval(loadStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Track live users with presence (only checked-in attendees)
  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: {
        presence: { key: 'stats-admin' }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const allPresences = Object.values(state).flat() as { user_id?: string }[];
      // Filter to only count guests (those with guest- prefix), exclude admin entries
      const guestUsers = allPresences
        .map(p => p.user_id)
        .filter(Boolean)
        .filter(id => !id.includes('-admin'));
      const uniqueGuests = new Set(guestUsers);
      console.log("[StatsOverview] Live guests:", uniqueGuests.size, Array.from(uniqueGuests));
      setLiveUsers(uniqueGuests.size);
    });

    channel.subscribe((status, err) => {
      console.log("[StatsOverview] Subscription status:", status, err);
      if (status === 'SUBSCRIBED') {
        channel.track({ user_id: 'stats-admin' }).catch(e => console.error("[StatsOverview] Track error:", e));
      }
      if (status === 'CHANNEL_ERROR') {
        console.error("[StatsOverview] Channel error:", err);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const attendanceRate = totalAttendees > 0 
    ? Math.round((checkedIn / totalAttendees) * 100) 
    : 0;

  const stats = [
    {
      label: "Total Registered",
      value: String(totalAttendees),
      icon: Users,
      color: "text-[#8b5cf6]",
      bgColor: "bg-[#8b5cf6]/10",
      borderColor: "border-[#8b5cf6]/20",
    },
    {
      label: "Checked In",
      value: String(checkedIn),
      subtext: `${attendanceRate}% attendance`,
      icon: UserCheck,
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    {
      label: "Live Now",
      value: String(liveUsers),
      subtext: liveUsers > 0 ? "People viewing" : "No viewers",
      icon: Activity,
      color: "text-[#10b981]",
      bgColor: "bg-[#10b981]/10",
      borderColor: "border-[#10b981]/20",
      pulse: liveUsers > 0,
    },
    {
      label: "Poll Engagement",
      value: checkedIn > 0 && questionsPushed > 0 ? `${Math.round((totalResponses / (checkedIn * questionsPushed)) * 100)}%` : "0%",
      subtext: `${totalResponses} responses / ${checkedIn} checked in / ${questionsPushed} pushed`,
      icon: TrendingUp,
      color: "text-[#06b6d4]",
      bgColor: "bg-[#06b6d4]/10",
      borderColor: "border-[#06b6d4]/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
          className={`p-6 bg-secondary/30 border ${stat.borderColor} rounded-2xl`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            {stat.pulse && (
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10b981] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10b981]"></span>
              </span>
            )}
          </div>
          <p className="text-muted-foreground mb-1" style={{ fontSize: "0.875rem" }}>
            {stat.label}
          </p>
          <p className="mb-1" style={{ fontSize: "2rem", fontWeight: 600, lineHeight: 1.2 }}>
            {stat.value}
          </p>
          {stat.subtext && (
            <p className="text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
              {stat.subtext}
            </p>
          )}
        </motion.div>
      ))}
    </div>
  );
}
