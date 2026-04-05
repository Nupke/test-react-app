import { useState, useCallback } from 'react';
import './App.css';

const MOVIES = [
  { title: 'The Shawshank Redemption', year: 1994, genre: 'Drama', rating: '9.3' },
  { title: 'Inception', year: 2010, genre: 'Sci-Fi', rating: '8.8' },
  { title: 'The Dark Knight', year: 2008, genre: 'Action', rating: '9.0' },
  { title: 'Pulp Fiction', year: 1994, genre: 'Crime', rating: '8.9' },
  { title: 'Forrest Gump', year: 1994, genre: 'Drama', rating: '8.8' },
  { title: 'The Matrix', year: 1999, genre: 'Sci-Fi', rating: '8.7' },
  { title: 'Interstellar', year: 2014, genre: 'Sci-Fi', rating: '8.7' },
  { title: 'The Grand Budapest Hotel', year: 2014, genre: 'Comedy', rating: '8.1' },
  { title: 'Parasite', year: 2019, genre: 'Thriller', rating: '8.5' },
  { title: 'Spirited Away', year: 2001, genre: 'Animation', rating: '8.6' },
  { title: 'The Godfather', year: 1972, genre: 'Crime', rating: '9.2' },
  { title: 'Whiplash', year: 2014, genre: 'Drama', rating: '8.5' },
  { title: 'Coco', year: 2017, genre: 'Animation', rating: '8.4' },
  { title: 'Get Out', year: 2017, genre: 'Thriller', rating: '7.7' },
  { title: 'La La Land', year: 2016, genre: 'Comedy', rating: '8.0' },
];

const GENRES = ['All', ...new Set(MOVIES.map((m) => m.genre))].sort();

function App() {
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [pickedMovie, setPickedMovie] = useState(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const filteredMovies =
    selectedGenre === 'All'
      ? MOVIES
      : MOVIES.filter((m) => m.genre === selectedGenre);

  const pickRandom = useCallback(() => {
    if (filteredMovies.length === 0 || isSpinning) return;
    setIsSpinning(true);
    setPickedMovie(null);

    setTimeout(() => {
      const index = Math.floor(Math.random() * filteredMovies.length);
      setPickedMovie(filteredMovies[index]);
      setIsSpinning(false);
    }, 800);
  }, [filteredMovies, isSpinning]);

  return (
    <div className="app">
      <h1>Movie Picker</h1>
      <p className="subtitle">Can't decide what to watch tonight? Let us pick for you!</p>

      <div className="genre-filter">
        {GENRES.map((genre) => (
          <button
            key={genre}
            className={`genre-btn ${selectedGenre === genre ? 'active' : ''}`}
            onClick={() => {
              setSelectedGenre(genre);
              setPickedMovie(null);
            }}
          >
            {genre}
          </button>
        ))}
      </div>

      <div className="picker-section">
        <button
          className="pick-btn"
          onClick={pickRandom}
          disabled={isSpinning || filteredMovies.length === 0}
        >
          {isSpinning ? 'Picking...' : 'Pick a Movie'}
        </button>
        <p className="movie-count">
          {filteredMovies.length} movie{filteredMovies.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {pickedMovie && (
        <div className="movie-card" data-testid="movie-card">
          <h2 className="movie-title">{pickedMovie.title}</h2>
          <div className="movie-details">
            <span className="movie-year">{pickedMovie.year}</span>
            <span className="movie-genre">{pickedMovie.genre}</span>
            <span className="movie-rating">IMDb {pickedMovie.rating}</span>
          </div>
        </div>
      )}

      <div className="movie-list">
        <h3>All {selectedGenre !== 'All' ? selectedGenre + ' ' : ''}Movies</h3>
        <ul>
          {filteredMovies.map((movie) => (
            <li
              key={movie.title}
              className={pickedMovie?.title === movie.title ? 'highlighted' : ''}
            >
              {movie.title} ({movie.year}) — {movie.rating}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
