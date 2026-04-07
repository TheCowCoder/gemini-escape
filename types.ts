export interface GameMessage {
  role: 'user' | 'model';
  text: string;
}

export interface LevelData {
  id: number;
  title: string;
  levelDescription: string;
  levelGoal: string;
}
