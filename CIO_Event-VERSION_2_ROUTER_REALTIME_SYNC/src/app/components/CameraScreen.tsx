// // import { useState, useRef, useEffect } from "react";
// // import { Loader2, User } from "lucide-react";
// // import { db, type Attendee } from "../utils/database";

// // interface CameraScreenProps {
// //   onSuccess: (attendee: Attendee) => void;
// // }

// // export function CameraScreen({ onSuccess }: CameraScreenProps) {
// //   const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "error">("idle");
// //   const [errorMessage, setErrorMessage] = useState("");
// //   const videoRef = useRef<HTMLVideoElement | null>(null);
// //   const streamRef = useRef<MediaStream | null>(null);

// //   // 🔥 FIXED CAMERA INIT
// //   useEffect(() => {
// //     const init = async () => {
// //       try {
// //         const stream = await navigator.mediaDevices.getUserMedia({
// //           video: true,
// //           audio: false
// //         });

// //         streamRef.current = stream;

// //         // wait for DOM
// //         setTimeout(() => {
// //           if (videoRef.current) {
// //             videoRef.current.srcObject = stream;

// //             videoRef.current.onloadedmetadata = () => {
// //               videoRef.current?.play().catch(console.error);

// //               setStatus("scanning");

// //               // start recognition
// //               setTimeout(() => {
// //                 recognizeFace();
// //               }, 1500);
// //             };
// //           }
// //         }, 300);

// //       } catch (err) {
// //         console.error("Camera error:", err);
// //         setStatus("error");
// //         setErrorMessage("Camera permission denied");
// //       }
// //     };

// //     init();

// //     return () => {
// //       if (streamRef.current) {
// //         streamRef.current.getTracks().forEach(track => track.stop());
// //       }
// //     };
// //   }, []);

// //   // 🔥 FACE RECOGNITION
// //   const recognizeFace = async () => {
// //     setStatus("processing");

// //     try {
// //       const video = videoRef.current;
// //       if (!video) throw new Error("Video not ready");

// //       if (video.videoWidth === 0) {
// //         throw new Error("Camera not ready");
// //       }

// //       // capture frame
// //       const canvas = document.createElement("canvas");
// //       canvas.width = video.videoWidth;
// //       canvas.height = video.videoHeight;

// //       const ctx = canvas.getContext("2d");
// //       ctx?.drawImage(video, 0, 0);

// //       const blob: Blob = await new Promise((resolve, reject) => {
// //         canvas.toBlob((b) => {
// //           if (b) resolve(b);
// //           else reject("Capture failed");
// //         }, "image/jpeg");
// //       });

// //       const formData = new FormData();
// //       formData.append("image", blob);

// //       const res = await fetch("http://localhost:5001/api/recognize", {
// //         method: "POST",
// //         body: formData
// //       });

// //       const data = await res.json();
// //       console.log("API Response:", data);

// //       let finalName = "Guest";

// //       if (data.faces && data.faces.length > 0) {
// //         const best = data.faces.reduce((a: any, b: any) =>
// //           b.score > a.score ? b : a
// //         );

// //         if (best.name !== "unknown") {
// //           finalName = best.name;
// //         }
// //       }

// //       const attendees = await db.getAttendees();

// //       const matched = attendees.find(
// //         (a) => a.name.toLowerCase() === finalName.toLowerCase()
// //       );

// //       // stop camera
// //       if (streamRef.current) {
// //         streamRef.current.getTracks().forEach(track => track.stop());
// //       }

// //       if (matched) {
// //         onSuccess(matched);
// //       } else {
// //         onSuccess({
// //           id: "guest-" + Date.now(),
// //           name: finalName
// //         } as Attendee);
// //       }

// //     } catch (err) {
// //       console.error(err);
// //       setStatus("error");
// //       setErrorMessage("Face recognition failed. Retrying...");

// //       setTimeout(() => {
// //         setStatus("scanning");
// //         recognizeFace();
// //       }, 2500);
// //     }
// //   };

// //   return (
// //     <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center">
// //       <h2 className="text-white text-xl mb-4">Face Authentication</h2>

// //       <p className="text-gray-400 mb-4">
// //         {status === "scanning" && "Align your face"}
// //         {status === "processing" && "Verifying..."}
// //         {status === "error" && errorMessage}
// //       </p>

// //       <div className="w-72 h-96 bg-gray-800 rounded-xl overflow-hidden relative">
// //         <video
// //           ref={videoRef}
// //           autoPlay
// //           playsInline
// //           muted
// //           className="w-full h-full object-cover"
// //         />

// //         {status === "processing" && (
// //           <div className="absolute inset-0 flex items-center justify-center bg-black/60">
// //             <Loader2 className="animate-spin text-white w-10 h-10" />
// //           </div>
// //         )}

// //         {status === "idle" && (
// //           <div className="absolute inset-0 flex items-center justify-center">
// //             <User className="w-16 h-16 opacity-20 text-white" />
// //           </div>
// //         )}
// //       </div>
// //     </div>
// //   );
// // }




import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { db, type Attendee } from "../utils/database";

interface CameraScreenProps {
  onSuccess: (attendee: Attendee) => void;
}

export function CameraScreen({ onSuccess }: CameraScreenProps) {
  const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 🔥 Start camera (hidden)
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      streamRef.current = stream;

      // hidden video setup
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();

            setStatus("scanning");

            setTimeout(() => {
              recognizeFace();
            }, 1500);
          };
        }
      }, 300);

    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage("Camera permission denied");
    }
  };

  // 🔥 Face recognition
  const recognizeFace = async () => {
    setStatus("processing");

    try {
      const video = videoRef.current;
      if (!video) throw new Error("Camera not ready");

      if (video.videoWidth === 0) {
        throw new Error("Camera not ready");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx?.drawImage(video, 0, 0);

      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject("Capture failed");
        }, "image/jpeg");
      });

      const formData = new FormData();
      formData.append("image", blob);

      const res = await fetch("http://localhost:5001/api/recognize", {
        method: "POST",
        body: formData
      });

      const data = await res.json();
      console.log("API:", data);

      // let finalName = "Guest";

      // if (data.faces && data.faces.length > 0) {
      //   const best = data.faces.reduce((a: any, b: any) =>
      //     b.score > a.score ? b : a
      //   );

      //   if (best.name !== "unknown") {
      //     finalName = best.name;
      //   }
      // }
      if (!data.faces || data.faces.length === 0) {
        throw new Error("No face detected");
      }

      const best = data.faces.reduce((a: any, b: any) =>
      b.score > a.score ? b : a
      );

      // ❌ If unknown → STOP here
      if (best.name === "unknown") {
        setStatus("error");
        setErrorMessage("Contact your admin");

        // stop camera
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        return;
      }
      const finalName = best.name;

      const attendees = await db.getAttendees();

      const matched = attendees.find(
        (a) => 
          a.name.toLowerCase() === finalName.toLowerCase() ||
          a.name.toLowerCase().includes(finalName.toLowerCase()) ||
          finalName.toLowerCase().includes(a.name.toLowerCase())
      );

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      if (matched) {
        onSuccess(matched);
      } else {
        onSuccess({
          id: "guest-" + Date.now(),
          name: finalName
        } as Attendee);
      }

    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMessage("Access Denied! Contact Your Admin....");
      // 🛑 STOP camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setTimeout(() => {
        setStatus("scanning");
        recognizeFace();
      }, 2500);
    }
  };

  
  //🎨 UI
  return (
    <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center">

      {/* Hidden Video */}
      <video ref={videoRef} style={{ display: "none" }} />

      <h2 className="text-white text-2xl font-semibold mb-2">
        Face Authentication
      </h2>

      <p
        className={`mb-6 text-center text-sm ${
          status === "error" ? "text-red-400" : "text-gray-400"
        }`}
      >
        {status === "scanning" && "Align your face with camera"}
        {status === "processing" && "Verifying your identity..."}
        {status === "error" && errorMessage}
      </p>

      <div className="w-72 h-80 rounded-3xl flex flex-col items-center justify-center shadow-xl
        bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700">

        {/* 🔄 Loading */}
        {(status === "processing" || status === "scanning") && (
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-300 text-sm">
              {status === "processing" ? "Processing..." : "Scanning..."}
            </p>
          </div>
        )}

        {/* ❌ Error */}
        {status === "error" && (
          <div className="text-center px-4">
            <div className="text-red-400 text-4xl mb-3">⚠️</div>
            <p className="text-red-300 text-sm font-medium">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Idle */}
        {status === "idle" && (
          <p className="text-gray-500">Initializing...</p>
        )}
      </div>
    </div>
  );
}

//     <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center">

//       {/* 🔥 Hidden video (IMPORTANT) */}
//       <video ref={videoRef} style={{ display: "none" }} />

//       <h2 className="text-white text-xl mb-4">Face Authentication</h2>

//       <p className="text-gray-400 mb-6 text-center">
//         {status === "scanning" && "Align your face"}
//         {status === "processing" && "Verifying your identity..."}
//         {status === "error" && errorMessage}
//       </p>

//       {/* 🔥 UI ONLY (NO CAMERA VIEW) */}
//       <div className="w-64 h-80 bg-gray-800 rounded-2xl flex items-center justify-center shadow-lg">

//         {status === "processing" || status === "scanning" ? (
//           <div className="text-center">
//             <Loader2 className="animate-spin text-blue-400 w-12 h-12 mx-auto mb-4" />
//             <p className="text-gray-300 text-sm">
//               {status === "processing" ? "Processing..." : "Scanning..."}
//             </p>
//           </div>
//         ) : (
//           <p className="text-gray-500">Initializing...</p>
//         )}

//       </div>
//     </div>
//   );
// }


// import { useState, useRef, useEffect } from "react";
// import { db, type Attendee } from "../utils/database";

// interface CameraScreenProps {
//   onSuccess: (attendee: Attendee) => void;
// }

// export function CameraScreen({ onSuccess }: CameraScreenProps) {
//   const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "error">("idle");
//   const [errorMessage, setErrorMessage] = useState("");

//   const videoRef = useRef<HTMLVideoElement | null>(null);
//   const streamRef = useRef<MediaStream | null>(null);

//   useEffect(() => {
//     startCamera();

//     return () => {
//       if (streamRef.current) {
//         streamRef.current.getTracks().forEach(track => track.stop());
//       }
//     };
//   }, []);

//   // 🎥 Start Camera
//   const startCamera = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: false
//       });

//       streamRef.current = stream;

//       setTimeout(() => {
//         if (videoRef.current) {
//           videoRef.current.srcObject = stream;

//           videoRef.current.onloadedmetadata = () => {
//             videoRef.current?.play();
//             setStatus("scanning");

//             setTimeout(() => {
//               recognizeFace();
//             }, 1500);
//           };
//         }
//       }, 300);

//     } catch (err) {
//       console.error(err);
//       setStatus("error");
//       setErrorMessage("Camera permission denied");
//     }
//   };

//   // 🧠 Face Recognition
//   const recognizeFace = async () => {
//     setStatus("processing");

//     try {
//       const video = videoRef.current;
//       if (!video) throw new Error("Camera not ready");

//       if (video.videoWidth === 0) {
//         throw new Error("Camera not ready");
//       }

//       // capture image
//       const canvas = document.createElement("canvas");
//       canvas.width = video.videoWidth;
//       canvas.height = video.videoHeight;

//       const ctx = canvas.getContext("2d");
//       ctx?.drawImage(video, 0, 0);

//       const blob: Blob = await new Promise((resolve, reject) => {
//         canvas.toBlob((b) => {
//           if (b) resolve(b);
//           else reject("Capture failed");
//         }, "image/jpeg");
//       });

//       const formData = new FormData();
//       formData.append("image", blob);

//       const res = await fetch("http://localhost:5001/api/recognize", {
//         method: "POST",
//         body: formData
//       });

//       const data = await res.json();
//       console.log("API:", data);

//       // ❌ No face
//       if (!data.faces || data.faces.length === 0) {
//         setStatus("error");
//         setErrorMessage("No face detected");
//         retry();
//         return;
//       }

//       // 🔍 Best match
//       const best = data.faces.reduce((a: any, b: any) =>
//         b.score > a.score ? b : a
//       );

//       // ❌ Unknown face
//       if (best.name === "unknown") {
//         setStatus("error");
//         setErrorMessage("Face not recognized");
//         retry();
//         return;
//       }

//       const finalName = best.name;

//       // stop camera
//       if (streamRef.current) {
//         streamRef.current.getTracks().forEach(track => track.stop());
//       }

//       const attendees = await db.getAttendees();

//       const matched = attendees.find(
//         (a) => a.name.toLowerCase() === finalName.toLowerCase()
//       );

//       // ✅ Success
//       if (matched) {
//         onSuccess(matched);
//       } else {
//         setStatus("error");
//         setErrorMessage("Access denied! Contact Your Admin....");
//       }

//     } catch (err) {
//       console.error(err);
//       setStatus("error");
//       setErrorMessage("Something went wrong");
//       retry();
//     }
//   };

//   // 🔄 Retry function
//   const retry = () => {
//     setTimeout(() => {
//       setStatus("scanning");
//       recognizeFace();
//     }, 2500);
//   };

//   // 🎨 UI
//   return (
//     <div className="min-h-screen bg-[#0a0c14] flex flex-col items-center justify-center">

//       {/* Hidden Video */}
//       <video ref={videoRef} style={{ display: "none" }} />

//       <h2 className="text-white text-2xl font-semibold mb-2">
//         Face Authentication
//       </h2>

//       <p
//         className={`mb-6 text-center text-sm ${
//           status === "error" ? "text-red-400" : "text-gray-400"
//         }`}
//       >
//         {status === "scanning" && "Align your face with camera"}
//         {status === "processing" && "Verifying your identity..."}
//         {status === "error" && errorMessage}
//       </p>

//       <div className="w-72 h-80 rounded-3xl flex flex-col items-center justify-center shadow-xl
//         bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700">

//         {/* 🔄 Loading */}
//         {(status === "processing" || status === "scanning") && (
//           <div className="text-center">
//             <div className="w-14 h-14 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
//             <p className="text-gray-300 text-sm">
//               {status === "processing" ? "Processing..." : "Scanning..."}
//             </p>
//           </div>
//         )}

//         {/* ❌ Error */}
//         {status === "error" && (
//           <div className="text-center px-4">
//             <div className="text-red-400 text-4xl mb-3">⚠️</div>
//             <p className="text-red-300 text-sm font-medium">
//               {errorMessage}
//             </p>
//           </div>
//         )}

//         {/* Idle */}
//         {status === "idle" && (
//           <p className="text-gray-500">Initializing...</p>
//         )}
//       </div>
//     </div>
//   );
// }
