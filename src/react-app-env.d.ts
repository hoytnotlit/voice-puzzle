/// <reference types="react-scripts" />

declare module 'react-speech-kit';

interface SDSContext {
    recResult: string;
    nluData: any;
    ttsAgenda: string;
    piece: string;
    degree: string;
    direction: string;
    mode: string;
    solved: boolean;
}

// TODO can event have id eg click event for both settings and start buttons?
type SDSEvent =
    | { type: 'CLICK' }
    | { type: 'SETTINGS' }
    | { type: 'WIN' }
    | { type: 'CONTINUE' }
    | { type: 'RECOGNISED' }
    | { type: 'DONE' }
    | { type: 'MAXSPEECH' }
    | { type: 'ASRRESULT', value: string }
    | { type: 'ENDSPEECH' }
    | { type: 'LISTEN' }
    | { type: 'SPEAK', value: string };
