
export interface Sprinkler {
	id: string;
	open: boolean;
	pressure: number;
	x: number;
	y: number;
	direction: number;
}

export interface Garden {
	time: string;
	raining: boolean;
	status: Record<string, Sprinkler>;
	config: Record<string, Sprinkler>;
}

export interface AppState {
  garden: Garden | null;
}

export type WSData = {topic: "garden/status", data: Garden};
