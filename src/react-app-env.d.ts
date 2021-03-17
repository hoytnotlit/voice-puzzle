/// <reference types="react-scripts" />

declare module 'react-speech-kit';

interface SDSContext {
    recResult: string;
    nluData: any;
    ttsAgenda: string;
    piece: string;
    degree: number;
    direction: string;
    mode: string;
    moves: number;
    help_msg: string;
}

// TODO can event have id eg click event for both settings and start buttons?
type SDSEvent =
    | { type: 'CLICK' }
    | { type: 'SETTINGS' }
    | { type: 'WIN' }
    | { type: 'CONTINUE' }
    | { type: 'LOSE' }
    | { type: 'RECOGNISED' }
    | { type: 'DONE' }
    | { type: 'MAXSPEECH' }
    | { type: 'ASRRESULT', value: string }
    | { type: 'ENDSPEECH' }
    | { type: 'LISTEN' }
    | { type: 'SPEAK', value: string };
