package com.pocketpiano.app;

import java.util.ArrayList;

/** Original finite demonstration rhythm, shared by live playback and video export. */
final class DrumPadBeats {
    static Song demo() {
        ArrayList<Song.Note> notes=new ArrayList<>();
        int[] fill={41,43,45,38};
        for(int step=0;step<32;step++) {
            long time=step*150L;
            notes.add(new Song.Note(step%8==7?46:42,step%2==0?67:49,time,90));
            if(step%8==0||step%8==4)notes.add(new Song.Note(36,90,time,190));
            if(step%8==2||step%8==6)notes.add(new Song.Note(38,78,time,140));
            if(step>=28)notes.add(new Song.Note(fill[step-28],78,time,140));
        }
        notes.add(new Song.Note(49,80,4800,700));
        return new Song("pad-beat-neon119","霓虹节拍","原创打击垫示范 · 电子鼓组",100,notes);
    }
}
