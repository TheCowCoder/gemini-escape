import type { LevelData } from './types';

export const LEVEL_1_DATA: LevelData = {
  id: 1,
  title: "The Chasm",
  levelDescription: `
    The player is on a cliff facing a wide chasm. About four meters across is another cliff with land.
    A man is standing on the other side, watching you with concentration. At his feet is a stake anchored to the ground.
    On the player's side of the cliff, there is a small, one-room house.
    Inside the house:
    - A desk with a knife on it.
    - A drawer with 3 compartments. The top compartment contains a shovel. The bottom one contains a long length of rope. The middle is empty.
    - A bookshelf filled with old books. One is a potion book. This book has pages for many potions (speed, love, etc.), but only the 'Potion of Balance' has obtainable ingredients. The other potions should require ingredients the player cannot find in this level.
    - A cabinet containing a pot and a cup, among other kitchenware.
    - A stove and a sink with running water.
    Outside the house, on the player's side of the cliff:
    - A sturdy oak tree stands near the cliff edge.
    - There are several loose rocks of various sizes.
    - The ground is soft dirt.
    - A single hopping frog can be found near a damp patch of ground.
    - Digging in the soft dirt will reveal earthworms.
  `,
  levelGoal: `The player must cross the chasm, get to the other side, and enter the hidden trapdoor at the bottom of a chilled pond located there.`,
};

export const LEVEL_2_DATA: LevelData = {
  id: 2,
  title: "The Crafting Battle",
  levelDescription: `
  The player is standing at the entrance of a large building (give it a description as if it's a battle arena)
  Upon entering the door, the player finds themself in a room filled with tools and objects. There is a digital sign that says, craft your battle gear now, then enter the arena. Your first opponent is: A man riding a wild armored hog. Build wisely.
  In the room, the back wall has a tool shelf full of tools. In front of it is a workstation with lots of machines such as a band saw and a hydraulic press
  On the left wall is hanging lots of objects. A wood plank, a bowling ball, a length of rope, lots more. Populate the wall with objects that can be used to craft but are not all-powerful like "a tank"
  On the right wall is hanging more objects. Truck tires, wooden wheels, a flagpole, (you describe more)
  On the far wall there is a sink, a stovetop and oven, a microwave, a toaster, a set of knives, a set of kitchenware
  There is a chest in the room. (I'll let you fill this with whatever you think would be a good addition to this crafting station)

  There is a large menacing looking door on the far wall. Through it the player emerges into the arena. The ceiling is open to the sky, and you are surrounded by people, chanting cynically
  After entering, the door shuts benhind you. A elevator in the center of the arena brings up your first opponent: a man riding a wild hog with armor

  After defeating the opponent, you hear a whir and a click from behind you. The door to the crafting quarters opens.
  When the player enters and closes the door, the digital sign makes a noise and changes to display: "Your next opponent is: A line of archers"
  When the player next opens the door, the arena is empty. When they close the door, a large battle-door on the far side of the arena opens and the archers pour in and begin attack.

  After defeating the archers, the same process repeats. This time the sign displays: "Your next opponent is: A giant cyclops"
  Process repeats. Next opponent is an army of 20 unarmed men.
  The next opponent is a wise old man who will only let you through the exit if you answer his question correctly
  The next opponent is a tank
  Next, upon entering the arena, you are dumped into a pit of water and there is a bullshark
  The last opponent... Is... YOU DECIDE! Make up an opponent to end it all.

  Upon defeating the last opponent, an armored apprentice enters the arena and asks you to come with him. He takes you on the central elevator and it elevates.
  When it reaches the upper level of the arena, you exit onto a downward staircase.

  Upon stepping on solid ground, the player emerges in a crowd of cheering people throwing riches and flowers at them.
  They make way for the player to approach the king, who gives the player a digital pad, with a touch-button with "Level 3" written on it.
  Upon pressing the button, the user beats level 2 and is teleported to level 3.
  `,
  levelGoal: `The player must use their creativity and wits to craft a solution that will allow them to conquer each of the increasingly stronger opponents one by one, emerge from the arena, take the tablet from the king, and teleport to level 3.`,
};


export const ALL_LEVELS: LevelData[] = [LEVEL_1_DATA, LEVEL_2_DATA];

export const MAX_PROMPT_LENGTH = 280;

export const LEVEL_COMPLETE_MARKER = "_LEVEL_COMPLETE_";
