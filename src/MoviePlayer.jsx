import { useEffect, useRef, useState } from "react";
import { onValue, ref } from "firebase/database";
import Hls from "hls.js";
import { database } from "./firebase.js";

const COUNTDOWN_SECONDS = 5;
const WAIT_TIMEOUT_MS = 90000;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function MoviePlayer({ movie, onBack }) {
  const [phase, setPhase] = useState("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [streamUrl, setStreamUrl] = useState(null);
  const [showSource, setShowSource] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const videoRef = useRef(null);

  const startPlayback = async () => {
    setErrorMessage("");
    setStreamUrl(null);
    setCountdown(COUNTDOWN_SECONDS);
    setShowSource(true);
    setPhase("preparing");
    try {
      const response = await fetch(`${BACKEND_URL}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId: movie.id, url: movie.sourceUrl }),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
    } catch {
      setShowSource(false);
      setErrorMessage("تعذر بدء تجهيز الفيلم. حاول مرة أخرى.");
      setPhase("error");
    }
  };

  useEffect(() => {
    if (phase !== "preparing") return undefined;
    const interval = setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    const timeout = setTimeout(() => {
      setShowSource(false);
      setErrorMessage("انتهت مهلة تجهيز الفيلم. حاول مرة أخرى.");
      setPhase("error");
    }, WAIT_TIMEOUT_MS);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "preparing") return undefined;
    const streamRef = ref(database, `movies/${movie.id}/streamUrl`);
    return onValue(streamRef, (snapshot) => {
      const url = snapshot.val();
      if (typeof url !== "string" || url === "") return;
      setShowSource(false);
      setStreamUrl(url);
      setPhase("playing");
    });
  }, [phase, movie.id]);

  useEffect(() => {
    if (phase !== "playing" || !streamUrl || !videoRef.current) return undefined;
    const video = videoRef.current;
    const isHls = streamUrl.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setErrorMessage("تعذر تشغيل الفيلم. حاول مرة أخرى.");
          setPhase("error");
        }
      });
      return () => hls.destroy();
    }

    video.src = streamUrl;
    return undefined;
  }, [phase, streamUrl]);

  useEffect(() => {
    const releaseStream = () => {
      fetch(`${BACKEND_URL}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId: movie.id }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("pagehide", releaseStream);
    return () => {
      window.removeEventListener("pagehide", releaseStream);
      releaseStream();
    };
  }, [movie.id]);

  return (
    <main className="player-page">
      <button className="back-button" onClick={onBack}>
        رجوع إلى الأفلام
      </button>

      <div className="player-frame">
        {phase === "playing" && (
          <video ref={videoRef} className="player-video" controls autoPlay playsInline />
        )}

        {phase !== "playing" && (
          <div className="player-poster" style={{ backgroundImage: `url(${movie.poster})` }}>
            <div className="player-overlay">
              {phase === "idle" && (
                <button className="play-button" onClick={startPlayback} aria-label="تشغيل">
                  ▶
                </button>
              )}

              {phase === "preparing" && (
                <div className="status-box" role="status">
                  <p>جاري تجهيز الفيلم</p>
                  {countdown > 0 ? (
                    <span className="countdown">{countdown}</span>
                  ) : (
                    <p className="status-hint">ما زال التحضير مستمراً، لحظات قليلة...</p>
                  )}
                </div>
              )}

              {phase === "error" && (
                <div className="status-box">
                  <p className="status-error">{errorMessage}</p>
                  <button className="retry-button" onClick={startPlayback}>
                    إعادة المحاولة
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {showSource && (
          <iframe
            className="hidden-source"
            src={movie.sourceUrl}
            title="مصدر الفيلم"
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            aria-hidden="true"
          />
        )}
      </div>

      <h1 className="player-title">{movie.title}</h1>
      <p className="player-description">{movie.description}</p>
    </main>
  );
}
