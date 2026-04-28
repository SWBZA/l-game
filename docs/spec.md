**Game Specification: L-Game**

### 1. Game Overview
The L-Game is a two-player abstract strategy board game invented by Edward de Bono. It uses a small board and very simple rules, but requires high-level strategic thinking. The objective is to move your L-shaped piece each turn so that on your opponent's next turn, they are left with no legal moves for their own L-piece.

### 2. Board
The game is played on a 4×4 grid of squares, creating a total of 16 cells.

### 3. Pieces
A standard game uses three types of pieces:
- **Player 1's L-Piece:** A 3×2 "L" shaped tetromino. It occupies exactly 4 cells.
- **Player 2's L-Piece:** An identical L-shaped tetromino in a contrasting color.
- **Two Neutral Pieces:** Two identical 1×1 pieces.

### 4. Initial Setup
All pieces begin in a fixed starting position:
- The two L-pieces are positioned in the center of the board.
- One neutral piece is placed in the upper-left corner of the board.
- The other neutral piece is placed in the bottom-left corner.

### 5. Rules of Play
Players alternate turns. On a player's turn, they **must** first move their own L-piece. After that, they **may optionally** move one of the two neutral pieces.

#### 5.1 Moving an L-Piece
- The piece is picked up and placed back onto empty squares anywhere on the board.
- It may be rotated or flipped over during the move.
- **Critical Rule:** The piece must end in a *different* position from where it started. It must cover at least one square it did not previously cover.
- Pieces may never overlap each other or hang off the edge of the board.

#### 5.2 Moving a Neutral Piece
- A player may choose to move either one of the two neutral pieces.
- The piece is simply picked up and placed on any empty square on the board.

### 6. Winning the Game
The game ends when a player cannot make a legal move with their L-piece on their turn. The opponent who forced this situation is the winner.

### 7. Technical Implementation Notes

#### 7.1 Board Representation
- Model the board as a 4×4 grid (arrays of cells).
- Encode an L-piece's orientation. An L-piece can be defined by the relative coordinates of its 4 squares from its "origin" (e.g., the top-left square of its bounding box). All legal orientations can be pre-calculated from a base shape by applying rotations and reflections.

#### 7.2 Move Legality Check
For an L-piece, the move is legal if:
- The piece is placed in a valid position where all 4 cells are empty.
- The *squares covered* set is not identical to the set of *squares covered* in the previous position.
- The piece does not overlap other pieces and is entirely within the 4×4 grid.

For a neutral piece, the move is legal if the destination square is empty.

#### 7.3 Win Condition Check
At the start of the current player's turn, the engine must check if the player has at least one legal L-piece move. If they have zero moves, the game is over and the previous player has won.

#### 7.4 Turn Flow Management
The game engine must strictly enforce the sequence: determine current player → L-piece movement block → neutral piece movement block → switch to other player. Block skipping logic should be implemented for the optional neutral move.
