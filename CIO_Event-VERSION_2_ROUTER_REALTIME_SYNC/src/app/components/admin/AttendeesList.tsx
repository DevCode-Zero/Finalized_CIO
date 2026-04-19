import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, CheckCircle2, Clock, User, MapPin, RefreshCw, Plus, X, Pencil, Trash2, Upload, Image, UploadCloud, FileImage } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase, PRESENCE_CHANNEL } from "../../utils/supabaseClient";
import { db, type Attendee } from "../../utils/database";

export function AttendeesList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", company: "" });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<File | null>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const loadAttendees = async () => {
    try {
      const data = await db.getAttendees();
      setAttendees(data);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Failed to load attendees:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAttendees();

    const channel = supabase
      .channel('attendees-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendees'
        },
        (payload) => {
          console.log("Attendee change detected:", payload);
          loadAttendees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Track online users
  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL);
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.values(state).flat() as { user_id: string; online_at: string }[];
      const names = users.map(u => u.user_id).filter(Boolean);
      setOnlineUsers(names);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: 'admin',
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredAttendees = attendees.filter(
    (attendee) =>
      attendee.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attendee.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      attendee.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRefresh = () => {
    setLoading(true);
    loadAttendees();
  };

  const openAddModal = () => {
    setEditingAttendee(null);
    setFormData({ name: "", email: "", company: "" });
    setShowModal(true);
  };

  const openEditModal = (attendee: Attendee) => {
    setEditingAttendee(attendee);
    setFormData({
      name: attendee.name,
      email: attendee.email,
      company: attendee.company,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim() || !formData.company.trim()) return;
    setSubmitting(true);
    try {
      if (editingAttendee) {
        await db.updateAttendee(editingAttendee.id, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          company: formData.company.trim(),
        });
      } else {
        await db.addAttendee(
          formData.name.trim(),
          formData.email.trim(),
          formData.company.trim()
        );
        if (previewImage) {
          const result = await db.uploadAttendeeImage(previewImage, formData.name.trim());
          if (result?.imageUrl) {
            await db.updateAttendeeImage(formData.name.trim(), result.imageUrl);
          }
        }
      }
      const message = editingAttendee ? "Attendee updated!" : "Attendee added!";
      setShowModal(false);
      setPreviewImage(null);
      // Show alert first, then reload after a short delay
      setTimeout(() => {
        loadAttendees();
      }, 500);
      alert(message);
    } catch (err: any) {
      console.error("Failed to save attendee:", err);
      alert("Failed to save attendee: " + (err?.message || err || "Unknown error"));
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm("Are you sure you want to delete this attendee?")) return;
    setDeletingId(id);
    try {
      // Remove from face recognition first
      try {
        await fetch("http://localhost:5001/remove", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
      } catch (faceErr) {
        console.error("Face removal error:", faceErr);
      }
      
      // Delete from database
      await db.deleteAttendee(id);
      loadAttendees();
    } catch (err) {
      console.error("Failed to delete attendee:", err);
    }
    setDeletingId(null);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
      
      if (!jsonData.length || jsonData.length < 2) {
        alert("Excel file is empty or has no data rows");
        setUploading(false);
        return;
      }
      
      const headers = jsonData[0].map(h => String(h).trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h === "name");
      const companyIdx = headers.findIndex(h => h === "company");
      const gmailIdx = headers.findIndex(h => h === "gmail" || h === "email");
      console.log("Headers:", headers);
      console.log("Indices:", nameIdx, companyIdx, gmailIdx);
      
      if (nameIdx === -1 || companyIdx === -1 || gmailIdx === -1) {
        alert("Excel must have columns: name, company, gmail (found: " + headers.join(", ") + ")");
        setUploading(false);
        return;
      }
      
      const attendees = jsonData.slice(1)
        .filter(row => row[nameIdx] && row[companyIdx] && row[gmailIdx])
        .map(row => ({
          name: String(row[nameIdx] || "").trim(),
          email: String(row[gmailIdx] || "").trim(),
          company: String(row[companyIdx] || "").trim(),
        }));
      
      if (attendees.length === 0) {
        alert("No valid attendees found in the Excel file. Please check the format.");
        return;
      }
      
      await db.addAttendees(attendees);
      alert(`Successfully added ${attendees.length} attendees!`);
      loadAttendees();
    } catch (err: any) {
      console.error("Failed to upload Excel:", err);
      alert("Failed to upload: " + (err?.message || err));
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setSelectedImages(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const handleClickBrowse = () => {
    console.log("Clicking browse");
    imageInputRef.current?.click();
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedImages(prev => [...prev, ...Array.from(files)]);
    }
  };

  const handleImageSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      setSelectedImages(Array.from(files));
    }
  };

  const openBulkImageModal = () => {
    console.log("Opening modal, selectedImages:", selectedImages.length);
    setShowImageModal(true);
  };

const uploadAllImages = async () => {
    console.log("Starting upload, files:", selectedImages.length);
    setImageUploading(true);
    let updated = 0;
    let created = 0;
    let errors = 0;
    
    try {
      for (const file of selectedImages) {
        const fileName = file.name.replace(/\.[^/.]+$/, "");
        console.log("Processing:", fileName);
        
        try {
          // Check if attendee exists
          const existing = attendees.find(a => a.name.toLowerCase() === fileName.toLowerCase());
          
          if (!existing) {
            // Create new attendee in database
            await db.addAttendee(fileName, "", "");
          }
          
          // Upload image and enroll face
          const result = await db.uploadAttendeeImage(file, fileName);
          
          if (result?.imageUrl) {
            await db.updateAttendeeImage(fileName, result.imageUrl);
          }
          
          if (existing) {
            updated++;
          } else {
            created++;
          }
        } catch (err: any) {
          console.error("Failed to upload:", file.name, err);
          errors++;
        }
      }
       
      alert(`Done! Updated: ${updated}, Created: ${created}, Errors: ${errors}`);
      loadAttendees();
    } catch (err: any) {
      console.error("Failed to process images:", err);
      alert("Failed: " + (err?.message || err));
    }
    
    setImageUploading(false);
    setShowImageModal(false);
    setSelectedImages([]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="mb-1" style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Attendees
          </h2>
          <p className="text-muted-foreground" style={{ fontSize: "0.9375rem" }}>
            {attendees.length} registered • {attendees.filter(a => a.checked_in_at).length} checked in
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span style={{ fontSize: "0.9375rem", fontWeight: 500 }}>Add Attendee</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span style={{ fontSize: "0.9375rem", fontWeight: 500 }}>Upload Excel</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx,.xls,.csv"
            onChange={handleExcelUpload}
            className="hidden"
          />
          <button
            onClick={openBulkImageModal}
            disabled={imageUploading}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors"
          >
            <Image className="w-5 h-5" />
            <span style={{ fontSize: "0.9375rem", fontWeight: 500 }}>Bulk Images</span>
          </button>
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            multiple
            onChange={handleBulkImageUpload}
            style={{ display: "none" }}
          />
        </div>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, or email..."
            className="w-full pl-12 pr-4 py-3.5 bg-secondary border border-border rounded-xl focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-muted-foreground text-xs">
          Updated {lastUpdate.toLocaleTimeString()}
        </span>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-xl hover:bg-secondary transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading attendees...</p>
        </div>
      ) : filteredAttendees.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-2xl">
          <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground" style={{ fontSize: "1rem" }}>
            {searchQuery ? `No attendees found matching "${searchQuery}"` : "No attendees registered yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAttendees.map((attendee, index) => (
            <motion.div
              key={attendee.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="p-5 bg-secondary/30 border border-border hover:border-primary/30 rounded-2xl transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center">
                  {attendee.image_url ? (
                    <img src={attendee.image_url} alt={attendee.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                      <User className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="mb-0.5" style={{ fontSize: "1.0625rem", fontWeight: 600 }}>
                        {attendee.name}
                      </p>
                      {attendee.title && (
                        <p className="text-muted-foreground mb-1" style={{ fontSize: "0.875rem" }}>
                          {attendee.title}
                        </p>
                      )}
                      <p className="text-muted-foreground" style={{ fontSize: "0.875rem" }}>
                        {attendee.company}
                      </p>
                    </div>

{(() => {
                      const isOnline = onlineUsers.some(name => 
                        attendee.name.toLowerCase().includes(name.toLowerCase()) ||
                        name.toLowerCase().includes(attendee.name.toLowerCase())
                      );
                      
                      if (isOnline) {
                        return (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                            <span className="text-primary" style={{ fontSize: "0.8125rem", fontWeight: 500 }}>
                              Checked In
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(attendee)}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(attendee.id, attendee.name)}
                        disabled={deletingId === attendee.id}
                        className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-destructive"
                        title="Delete"
                      >
                        {deletingId === attendee.id ? (
                          <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-muted-foreground" style={{ fontSize: "0.8125rem" }}>
                    <span>{attendee.email}</span>
                    {attendee.checked_in_at && (
                      <>
                        <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(attendee.checked_in_at).toLocaleTimeString()}
                        </span>
                      </>
                    )}
                    {attendee.location && (
                      <>
                        <span className="w-1 h-1 bg-muted-foreground rounded-full" />
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {attendee.location}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md mx-4 bg-background border border-border rounded-2xl p-6 shadow-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold">
                  {editingAttendee ? "Edit Attendee" : "Add Attendee"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editingAttendee?.image_url && (
                <div className="mb-4 flex justify-center relative">
                  <img src={editingAttendee.image_url} alt="Profile" className="w-24 h-24 rounded-xl object-cover" />
                  <div className="absolute -bottom-2 -right-2 flex gap-1">
                    <label className="p-1.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          await db.uploadAttendeeImage(file, editingAttendee.name);
                          loadAttendees();
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm("Delete this image?")) return;
                        await db.updateAttendee(editingAttendee.id, { image_url: "" } as any);
                        loadAttendees();
                        setEditingAttendee({ ...editingAttendee, image_url: "" });
                      }}
                      className="p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Company *</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:outline-none focus:border-primary"
required
                />
                </div>

                {!editingAttendee && (
                <div>
                  <label className="block text-sm font-medium mb-2">Image</label>
                  {previewImage ? (
                    <div className="relative inline-block">
                      <img 
                        src={URL.createObjectURL(previewImage)} 
                        alt="Preview" 
                        className="w-24 h-24 rounded-xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewImage(null)}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => previewInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file && file.type.startsWith("image/")) {
                          setPreviewImage(file);
                        }
                      }}
                      className="w-24 h-24 border-2 border-dashed border-border rounded-xl flex items-center justify-center cursor-pointer hover:border-primary/50"
                    >
                      <Image className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <input
                    ref={previewInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setPreviewImage(file);
                    }}
                  />
                </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setPreviewImage(null); }}
                    className="flex-1 px-4 py-3 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : editingAttendee ? (
                      "Save Changes"
                    ) : (
                      "Add"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showImageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImageModal(false)}
              className="absolute inset-0 bg-black/50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg mx-4 bg-background border border-border rounded-2xl p-6 shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold">Upload Images</h3>
                <button
                  onClick={() => setShowImageModal(false)}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div 
                className="border-2 border-dashed border-border rounded-xl p-6 text-center mb-4 cursor-pointer"
                onDrop={handleImageDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={handleClickBrowse}
              >
                <UploadCloud className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground text-sm">Drop images here or click to browse</p>
              </div>

              <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                {selectedImages.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-secondary rounded-lg">
                    <FileImage className="w-5 h-5 text-muted-foreground" />
                    <span className="flex-1 text-sm truncate">{file.name}</span>
                    <button
                      onClick={() => removeSelectedImage(index)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="flex-1 px-4 py-3 bg-secondary border border-border rounded-xl hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={uploadAllImages}
                  disabled={imageUploading || selectedImages.length === 0}
                  className="flex-1 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {imageUploading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    `Upload All (${selectedImages.length})`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
