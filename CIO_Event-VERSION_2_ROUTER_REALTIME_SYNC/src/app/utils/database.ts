import { supabase } from "./supabaseClient";

export interface Attendee {
  id: string;
  name: string;
  email: string;
  company: string;
  image_url?: string;
  checked_in_at: string;
}

export interface Question {
  id: string;
  text: string;
  type: "multiple-choice" | "text";
  options: string[] | null;
  status: "draft" | "sent" | "completed";
  sent_at: string | null;
  created_at: string;
}

export interface Response {
  id: string;
  question_id: string;
  attendee_id: string;
  answer_text: string | null;
  answer_index: number | null;
  attendee_name?: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  status: string;
  created_at: string;
  speaker_name?: string;
  speaker_company?: string;
  speaker_bio?: string;
}

export interface EventSettings {
  id: string;
  featured_speaker_name: string;
  featured_speaker_company: string;
  featured_speaker_bio: string;
  updated_at: string;
}

export const db = {
  async addAttendee(name: string, email: string, company: string) {
    const { data, error } = await supabase
      .from("attendees")
      .insert([{ name, email, company }])
      .select()
      .single();
    if (error) throw error;
    return data as Attendee;
  },

async addAttendees(attendees: { name: string; email: string; company: string }[]) {
    const { data, error } = await supabase
      .from("attendees")
      .insert(attendees)
      .select();
    if (error) throw error;
    return data as Attendee[];
  },

  async updateAttendeeImage(name: string, imageUrl: string) {
    const { error } = await supabase.from('attendees').update({ image_url: imageUrl }).ilike('name', `%${name}%`);
    if (error) throw error;
  },

  async uploadAttendeeImage(file: File, attendeeName: string): Promise<{ imageUrl: string }> {
    const fileName = `${attendeeName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.${file.name.split('.').pop()}`;
    
    // Upload image to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('attendee-images')
      .upload(fileName, file);
    
    if (uploadError) {
      console.error("Storage error:", uploadError);
      throw new Error("Storage: " + uploadError.message);
    }
    
    const { data: urlData } = supabase.storage.from('attendee-images').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;
    
    // Enroll face in recognition system
    try {
      const formData = new FormData();
      formData.append("name", attendeeName);
      formData.append("images", file);
      
      const enrollRes = await fetch("http://localhost:5001/enroll", {
        method: "POST",
        body: formData
      });
      
      const enrollResult = await enrollRes.json();
      console.log("Face enrolled:", enrollResult);
    } catch (enrollErr) {
      console.error("Face enrollment error:", enrollErr);
    }
    
    return { imageUrl };
  },

  async updateAttendee(id: string, updates: { name?: string; email?: string; company?: string }) {
    const { data, error } = await supabase
      .from("attendees")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Attendee;
  },

  async deleteAttendee(id: string) {
    // Get attendee name first
    const { data: attendee } = await supabase.from('attendees').select('name').eq('id', id).single();
    const name = attendee?.name;
    
    // Delete from database
    const { error } = await supabase
      .from("attendees")
      .delete()
      .eq("id", id);
    if (error) throw error;
    
    // Remove from face recognition system
    if (name) {
      try {
        await fetch("http://localhost:5001/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
      } catch (enrollErr) {
        console.error("Face removal error:", enrollErr);
      }
    }
  },

  async getAttendees() {
    const { data, error } = await supabase
      .from("attendees")
      .select("*")
      .order("checked_in_at", { ascending: false });
    if (error) throw error;
    return data as Attendee[];
  },

  async getAttendeeCount() {
    const { count, error } = await supabase
      .from("attendees")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return count || 0;
  },

  async addQuestion(text: string, type: "multiple-choice" | "text", options?: string[]) {
    const { data, error } = await supabase
      .from("questions")
      .insert([{ text, type, options }])
      .select()
      .single();
    if (error) throw error;
    return data as Question;
  },

  async getQuestions() {
    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Question[];
  },

  async updateQuestionStatus(id: string, status: "draft" | "sent" | "completed") {
    const updates: Partial<Question> = { status };
    if (status === "sent") {
      updates.sent_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from("questions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Question;
  },

  async deleteQuestion(id: string) {
    const { error } = await supabase
      .from("questions")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async addResponse(questionId: string, attendeeId: string, answerIndex?: number, answerText?: string, attendeeName?: string) {
    const { data, error } = await supabase
      .from("responses")
      .insert([{ question_id: questionId, attendee_id: attendeeId, answer_index: answerIndex, answer_text: answerText, attendee_name: attendeeName }])
      .select()
      .single();
    if (error) throw error;
    return data as Response;
  },

  async getResponses(questionId: string) {
    const { data, error } = await supabase
      .from("responses")
      .select("*")
      .eq("question_id", questionId);
    if (error) throw error;
    return data as Response[];
  },

  async getResponsesForAttendee(attendeeId: string) {
    const { data, error } = await supabase
      .from("responses")
      .select("*")
      .eq("attendee_id", attendeeId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as Response[];
  },

  async getResponseCount(questionId: string) {
    const { count, error } = await supabase
      .from("responses")
      .select("*", { count: "exact", head: true })
      .eq("question_id", questionId);
    if (error) throw error;
    return count || 0;
  },

  async getTotalResponses() {
    const { count, error } = await supabase
      .from("responses")
      .select("*", { count: "exact", head: true });
    if (error) throw error;
    return count || 0;
  },

  async getUniqueRespondents() {
    const { data, error } = await supabase
      .from("responses")
      .select("attendee_id");
    if (error) throw error;
    const uniqueIds = new Set(data?.map(r => r.attendee_id) || []);
    return uniqueIds.size;
  },

  async addMeeting(title: string, startTime: string, endTime?: string, description?: string, location?: string) {
    const { data, error } = await supabase
      .from("meetings")
      .insert([{ title, start_time: startTime, end_time: endTime, description, location }])
      .select()
      .single();
    if (error) throw error;
    return data as Meeting;
  },

  async getMeetings() {
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data as Meeting[];
  },

  async deleteMeeting(id: string) {
    const { error } = await supabase
      .from("meetings")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async updateMeeting(id: string, updates: { title?: string; start_time?: string; end_time?: string; description?: string; location?: string }) {
    const { data, error } = await supabase
      .from("meetings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Meeting;
  },

  async getEventSettings() {
    const { data, error } = await supabase
      .from("event_settings")
      .select("*")
      .eq("id", "default")
      .single();
    if (error) {
      console.error("Failed to get event settings:", error);
      return {
        id: "default",
        featured_speaker_name: "Dr. Sarah Mitchell",
        featured_speaker_company: "CIO, GlobalTech Industries",
        featured_speaker_bio: "Transforming Enterprise Technology: Lessons from a Billion-Dollar Journey",
        updated_at: new Date().toISOString(),
      } as EventSettings;
    }
    return data as EventSettings;
  },

  async updateEventSettings(settings: Partial<EventSettings>) {
    const { data, error } = await supabase
      .from("event_settings")
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq("id", "default")
      .select()
      .single();
    if (error) throw error;
    return data as EventSettings;
  },

  async checkInAttendee(id: string) {
    const { data, error } = await supabase
      .from("attendees")
      .update({ checked_in_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Attendee;
  },

  async getCheckedInAttendeeById(id: string) {
    const { data, error } = await supabase
      .from("attendees")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Attendee;
  },
};