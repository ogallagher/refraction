# Refraction

A local & remote asynchronous multiplayer action shooter.

## Play

### Controls

WASD or arrow keys to run up, left, down, and right.

Point and left-click to point and shoot.

The bar at the top of the game window shows a combination of remaining ammunition and remaining shots in the current clip. The clip limits shot frequency (has a capacity and continuous reload speed), and ammunition limits total shots per round.

Your player is marked with a black X. Teams are denoted by colors (blue, orange, green, magenta).

Below the game window is a switch to toggle local vs online mode. In online mode, you pick a username and pass turns between your and other usernames.

### System requirements

Just a computer browser with a keyboard and mouse. Mobile devices are not yet supported (the UI would first need some major improvements, and the game window would need touch control support). Most browsers should work (I've done cursory testing in Chrome, Firefox, and Safari).

### Gameplay

Your objective is to get as many of your players to the opposite base as possible, while at the same time allowing as few of the players from the other team get to your base as possible. You get one point for each player that reaches the opposing base within the time limit.

The game can be played with 2,3, or 4 teams. The arena is a square, and each base is a corner. Let's assume the game is just 2 teams, blue vs orange, and run an example.

1. The first turn, blue moves their player to the opposite corner, which seems easy enough.

![refraction_playthrough_local_1_1](https://user-images.githubusercontent.com/17031438/101527575-2fffcd80-395c-11eb-8ad5-2fe291c7d7b0.gif)

2. On orange's turn, they then run the opposite direction, and takes out blue's first player on the way.

![refraction_playthrough_local_1_2](https://user-images.githubusercontent.com/17031438/101527578-30986400-395c-11eb-9ed6-459dea4be897.gif)

3. ...

![refraction_playthrough_local_1_3](https://user-images.githubusercontent.com/17031438/101527580-3130fa80-395c-11eb-8c09-874adbb4a2a1.gif)

4. ...

![refraction_playthrough_local_1_4](https://user-images.githubusercontent.com/17031438/101527582-3130fa80-395c-11eb-8775-6ed0934fdff2.gif)

5. ...

![refraction_playthrough_local_1_5](https://user-images.githubusercontent.com/17031438/101527585-31c99100-395c-11eb-812a-5d420b8c126b.gif)

6. ...

![refraction_playthrough_local_1_6](https://user-images.githubusercontent.com/17031438/101527586-32622780-395c-11eb-846d-ec1866b0aba5.gif)

7. ...

![refraction_playthrough_local_1_7](https://user-images.githubusercontent.com/17031438/101527588-32fabe00-395c-11eb-95a6-3fe2dae94fcb.gif)

8. ...

![refraction_playthrough_local_1_8](https://user-images.githubusercontent.com/17031438/101527592-32fabe00-395c-11eb-82a9-d9927495be44.gif)

Eventually, the game is over (default is 8 turns). The winning team has the most points total. The game then enters playback mode, and we can review how it went!

![refraction_playthrough_local_1_9](https://user-images.githubusercontent.com/17031438/101527594-33935480-395c-11eb-834d-3525918ecf31.gif)

## Screenshots

I'll include around five screenshots.

## Customization

I added a **game configuration** section where some basic game settings can be set prior to playing the first turn.

You can currently customize:

- number of teams
- number of rounds
- player run speed
- player radius
- bullet tracer length
- frame limit (round time limit, in frames)

## Development

**Refraction** is a pretty early prototype, so I'll hopefully be updating it frequently, and am looking forward to suggestions.