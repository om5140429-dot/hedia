import { useState } from "react";
import { movies } from "./movies.js";
import MoviePlayer from "./MoviePlayer.jsx";

export default function App() {
  const [selectedMovie, setSelectedMovie] = useState(null);

  if (selectedMovie) {
    return <MoviePlayer movie={selectedMovie} onBack={() => setSelectedMovie(null)} />;
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>مشغل الأفلام</h1>
        <p>اختر فيلماً وابدأ المشاهدة</p>
      </header>
      <section className="movie-grid">
        {movies.map((movie) => (
          <button key={movie.id} className="movie-card" onClick={() => setSelectedMovie(movie)}>
            <img src={movie.poster} alt={movie.title} loading="lazy" />
            <div className="movie-card-body">
              <h2>{movie.title}</h2>
              <p>{movie.description}</p>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}
