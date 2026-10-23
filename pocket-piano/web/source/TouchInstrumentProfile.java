package com.pocketpiano.app;

import java.util.Set;

/** Fixed touch geometry and original-pitch routing for the instrument-specific pages. */
public final class TouchInstrumentProfile {
    public static final int NONE = 0, STRINGS = 1, GUITAR = 2, WIND = 3, MALLETS = 4, HARMONICA = 5;
    private static final int[] HARP = {60,64,67,72,76,62,67,71,74,77,79,84,88,91,96,81,83,86,89,93};
    private static final int[] VIOLIN = {55, 62, 69, 76};
    private static final int[] VIOLA = {48, 55, 62, 69};
    private static final int[] CELLO = {36, 43, 50, 57};
    private static final int[] BASS = {28, 33, 38, 43};
    private static final int[] GUITAR_OPEN = {40, 45, 50, 55, 59, 64};
    private static final String[] NOTE_NAMES = {"C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"};
    private TouchInstrumentProfile() {}

    public static int family(int preset) {
        if(Instruments.isDeltaHarmonica(preset))return HARMONICA;
        if(Instruments.isSampled(preset)){int gm=Instruments.gmProgram(preset);if(gm==22)return HARMONICA;if(gm>=24&&gm<=39)return GUITAR;if(gm>=40&&gm<=46||gm>=48&&gm<=55||gm==110)return STRINGS;if(gm>=56&&gm<=79||gm==109||gm==111)return WIND;if(gm>=8&&gm<=15||gm==47||gm>=104&&gm<=108||gm>=112&&gm<=119)return MALLETS;}
        if (preset == 7 || preset >= 30 && preset <= 33) return STRINGS;
        if (preset == 6) return GUITAR;
        if (preset == 8) return WIND;
        if (preset == 2 || preset == 9 || preset == 20 || preset == 26 || preset == 27) return MALLETS;
        return NONE;
    }
    public static boolean usesDedicatedSurface(int preset) { return family(preset) != NONE; }
    public static boolean isBass(int preset){return Instruments.isSampled(preset)&&Instruments.gmProgram(preset)>=32&&Instruments.gmProgram(preset)<=39;}
    public static int columns(int preset) {
        if(Instruments.isDeltaHarmonica(preset))return 4;
        switch (family(preset)) { case STRINGS: return 4; case GUITAR: return isBass(preset)?4:6; case WIND: return 3; case MALLETS: return 6; case HARMONICA: return 5; default: return 0; }
    }
    public static int rows(int preset) {
        if(Instruments.isDeltaHarmonica(preset))return 2;
        switch (family(preset)) { case STRINGS: return 7; case GUITAR: return isBass(preset)?7:5; case WIND: return 4; case MALLETS: return 2; case HARMONICA: return 4; default: return 0; }
    }
    public static int keyCount(int preset) { return rows(preset) * columns(preset); }

    /** Default octave 4 retains each instrument's actual open strings rather than a common C4. */
    public static int freePitch(int preset, int key, int octave) {
        int count = keyCount(preset);
        if (key < 0 || key >= count) return -1;
        int pitch;
        if (Instruments.isDeltaHarmonica(preset)) pitch=72+new int[]{0,2,4,5,7,9,11,12}[key];
        else if (family(preset) == HARMONICA) pitch = HARP[key];
        else if (family(preset) == STRINGS) {
            int[] open = preset == 30 || Instruments.isSampled(preset)&&Instruments.gmProgram(preset)==40 ? VIOLIN : preset == 32 || Instruments.isSampled(preset)&&Instruments.gmProgram(preset)==42 ? CELLO : preset == 33 || Instruments.isSampled(preset)&&Instruments.gmProgram(preset)==43 ? BASS : VIOLA;
            pitch = open[key % 4] + key / 4;
        } else if (family(preset) == GUITAR) pitch = isBass(preset)?BASS[key%4]+key/4:GUITAR_OPEN[key % 6] + key / 6;
        else pitch = (family(preset) == WIND ? 72 : 60) + key;
        return Math.max(0, Math.min(127, pitch + (Math.max(1, Math.min(7, octave)) - 4) * 12));
    }

    /** Prefer the real finger position, then the nearest same-chroma position. The board never scrolls. */
    public static int keyForPitch(int preset, int pitch, int octave) {
        if (pitch < 0 || pitch > 127) return -1;
        int result = -1, distance = Integer.MAX_VALUE;
        for (int key = 0; key < keyCount(preset); key++) {
            int natural = freePitch(preset, key, octave);
            if (natural % 12 != pitch % 12) continue;
            int next = Math.abs(natural - pitch);
            if (next < distance) { result = key; distance = next; }
        }
        // Phone practice also routes bent/overblown source notes to the nearest hole.
        // resolve() retains the original pitch; free play remains the Richter chart.
        if(result<0 && family(preset)==HARMONICA) for(int key=0;key<keyCount(preset);key++){
            int next=Math.abs(freePitch(preset,key,octave)-pitch);
            if(next<distance){result=key;distance=next;}
        }
        return result;
    }

    /** Guided notes keep their exact source octave; multiple candidates resolve deterministically. */
    public static int resolve(int preset, int key, Set<Integer> expected, int octave) {
        int natural = freePitch(preset, key, octave);
        if (natural < 0) return -1;
        int result = -1, distance = Integer.MAX_VALUE;
        if (expected != null) for (Integer pitch : expected) {
            if (pitch == null || keyForPitch(preset, pitch, octave) != key) continue;
            int next = Math.abs(natural - pitch);
            if (next < distance || next == distance && (result < 0 || pitch < result)) {
                result = pitch; distance = next;
            }
        }
        return result >= 0 ? result : natural;
    }
    public static boolean hasCollision(int preset, Set<Integer> pitches, int octave) {
        if (pitches == null || pitches.size() < 2) return false;
        boolean[] used = new boolean[keyCount(preset)];
        for (Integer pitch : pitches) if (pitch != null) {
            int key = keyForPitch(preset, pitch, octave);
            if (key < 0 || used[key]) return true;
            used[key] = true;
        }
        return false;
    }
    public static String pitchName(int pitch) {
        return pitch < 0 || pitch > 127 ? "—" : NOTE_NAMES[pitch % 12] + (pitch / 12 - 1);
    }
}
