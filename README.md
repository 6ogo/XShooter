# XShooter

[XShooter](https://x-shooter.vercel.app/) is a fast-paced 2D multiplayer shooter game where players compete to be the last one standing. Viewed from a top-down perspective, players are represented by their X profile pictures and shoot small balls at each other to reduce opponents' health. Each player starts with 100 HP, can fire 5 shots before a 3-second cooldown, and plays until eliminated. Log in with your X account, invite friends to custom rooms or join quickplay lobbies, and climb the leaderboard by tracking wins, kills, and accuracy.

## Features

- **Authentication**: Log in using your X (Twitter) account via OAuth.
- **Gameplay**:
  - Players start with 100 HP, displayed above their X profile picture.
  - Fire 5 shots in a burst, followed by a 3-second cooldown.
  - Each shot deals 20 HP damage; players die when HP reaches 0 and are removed from the game.
  - Unlimited shots until death, with the last player standing declared the winner.
- **Multiplayer**:
  - Create a room and share a link to invite friends, with the host starting the game.
  - Quickplay matches you with other players in an online lobby.
- **Leaderboard**:
  - Tracks wins, kills, and accuracy (shots hit/shots fired).
  - Displays top 20 players and your own rank/stats, with clickable X handles (@username).
- **Cross-Platform**: Playable on both desktop and mobile devices with responsive controls.

## Technical Stack

- **Frontend**: Phaser (HTML5 game framework for 2D games)
- **Backend**: Node.js with Express for server, Socket.io for real-time multiplayer
- **Authentication**: Passport.js for X OAuth
- **Database**: MongoDB for storing player stats (wins, kills, accuracy)

## How to Play
Log In: Use your X account to log in via the OAuth prompt or register an account with email/password.

## Choose a Mode:
Create Room: Generate a room link to share with friends. As the host, start the game when ready.
Join Room: Enter a room link to join a friend’s game.
Quickplay: Join a public lobby with other online players.

## Controls:
### Desktop:
Move: WASD or arrow keys
Shoot: Click the mouse in the direction to fire

### Mobile:
Move: Virtual joystick (drag on the left side of the screen)
Shoot: Tap the screen to fire in that direction

## Gameplay:
Each player starts with 100 HP, shown above their X profile picture.
Fire up to 5 shots, then wait 3 seconds for a cooldown.
Each shot deals 20 HP damage. Reduce opponents’ HP to 0 to eliminate them.
When a player dies, their image is removed from the board.
The last player standing wins the game.

## Leaderboard:
After each game, check the leaderboard for wins, kills, and accuracy.
See your rank and compare with the top 20 players, with X handles linked.

## Achievements
Unlock achievements by completing challenges in XShooter:

- Sharpshooter: Achieve 50% accuracy in a single game.
- Survivor: Win a game without taking any damage.
- Kill Streak: Eliminate 3 players in a row without dying.
- Social Butterfly: Play 10 games with friends.
- Top of the Board: Reach the top 10 in the leaderboard for wins.
(More achievements available in-game!)

## Contributing
We welcome contributions to XShooter! To contribute:

Fork the repository.
Create a new branch (git checkout -b feature/your-feature).
Make your changes and commit (git commit -m "Add your feature").
Push to your fork (git push origin feature/your-feature).
Open a pull request on the main repository.
Please ensure your code follows the existing style (or improved lol) and includes tests where applicable.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For issues, suggestions, or questions:

Open an issue on the GitHub repository.
Reach out via X: @yak0u8.

**Happy shooting!**
