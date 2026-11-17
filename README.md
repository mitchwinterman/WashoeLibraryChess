# Booked for Chess

A chess board, computer opponent, and training site for the Booked for Chess meetup at Washoe County Library System. It is a static website (HTML, CSS, and JavaScript only) hosted on GitHub Pages. It uses no outside services, so it doesn't depend on any site the county network might block.

## What's here now

- **Board:** Move pieces for both sides, with arrows and circles (right-click), a two-column move list with side lines, notes on moves, and opening names.
- **Set Up Position:** Place pieces, choose whose move it is, set castling rights, or paste a FEN.
- **Play the Computer:** Play as White, Black, or a random color against Stockfish at levels 1 through 8, from a new game or from the position on the board. Includes Hint, Take Back, and Resign.
- **Load and save:** Paste a PGN or FEN, or copy or download the game as a PGN.
- **Puzzles:** About 41,500 Lichess puzzles by theme (fork, pin, mate in 2, back rank mate, and more) and difficulty. Wrong moves can be retried, with Hint, Show Solution, an optional timer, and a first-try score.
- **Printable worksheets:** 6, 12, or 18 puzzle diagrams by theme and difficulty, with an answer key.
- **Projector View:** Hides the header and fills the screen height with the board. Press P to turn it on and P or Esc to turn it off.

Keyboard: Left and Right arrows step through moves, Up and Down jump to the start and end, F flips the board, and P toggles Projector View.

## Coming next

- Woodpecker-style opening and endgame drills

## Turning on the website

Go to **Settings > Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then choose branch `main` and folder `/ (root)`, and click **Save**. The site appears at `https://mitchwinterman.github.io/WashoeLibraryChess/` within a few minutes.

## Credits and licenses

| Part | Source | License |
|---|---|---|
| Chess engine | Stockfish 10 via [Stockfish.js](https://github.com/nmrugg/stockfish.js) | GPL-3.0 (`vendor/stockfish/Copying.txt`) |
| Board | [cm-chessboard](https://github.com/shaack/cm-chessboard) | MIT |
| Chess rules | [chess.js](https://github.com/jhlywa/chess.js) 0.13.4 | BSD-2-Clause |
| Opening names | [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) | CC0 |
| Puzzles | [Lichess puzzle database](https://huggingface.co/datasets/Lichess/chess-puzzles), filtered to about 41,500 popular, well-tested puzzles | CC0 |
| Font | [Atkinson Hyperlegible](https://github.com/googlefonts/atkinson-hyperlegible) (Braille Institute) | SIL Open Font License |

Because Stockfish is GPL-licensed, this site's code is shared publicly in this repository.
