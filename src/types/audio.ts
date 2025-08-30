export interface AudioFile {
  id: string;
  name: string;
  file: File;
  duration: number;
  buffer?: AudioBuffer;
  url: string;
  waveformData?: Float32Array;
}

export interface Track {
  id: string;
  audioFileId: string;
  name: string;
  startTime: number;
  endTime: number;
  volume: number;
  muted: boolean;
  soloed: boolean;
  trimStart: number;
  trimEnd: number;
  trackIndex: number;
  color?: string;
  selected?: boolean;
  blob?: Blob;
  stemUrl?: string
}

export interface Project {
  id: string;
  name: string;
  tracks: Track[];
  bpm: number;
  duration: number;
  masterVolume: number;
  masterEQ: {
    low: number;
    mid: number;
    high: number;
  };
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  bpm: number;
}

export interface Selection {
  trackId: string;
  startTime: number;
  endTime: number;
}
