package com.pocketpiano.app;

/** Stable preset IDs shared by audio, icons, recordings and MIDI export. */
public final class Instruments {
    public static final int DRUM_KIT=29, VIOLIN=30, VIOLA=31, CELLO=32, DOUBLE_BASS=33;
    public static final int DELTA_FIRST=170, DELTA_LAST=175;
    private static final String[] DELTA_NAMES={"游戏口琴 · 经典簧片","游戏口琴 · 温暖木腔","游戏口琴 · 明亮金属","游戏口琴 · 柔和气息","游戏口琴 · 厚实低音","游戏口琴 · 双簧颤音"};
    public static boolean isDeltaHarmonica(int id){return id>=DELTA_FIRST&&id<=DELTA_LAST;}
    public static final int RETRO_FIRST=162, RETRO_LAST=169, RETRO_DEFAULT=162;
    private static final String[] RETRO_NAMES={"游戏机方波主奏","25%门控脉冲","三角芯片低音","8bit快速琶音","像素钟琴","街机FM铜管","赛车同步主奏","游戏机合唱垫"};
    private static final String[] RETRO_DETAILS={"带限方波 · 快起音主旋律","宽度调制与节奏门控 · 鼻音跳奏","带限三角波 · 双级低通低音","45毫秒八度五度循环 · 量化采样保持","非整数倍泛音 · 渐暗敲击尾音","双算子FM · 反馈与动态调制深度","4倍采样硬同步 · 明暗扫频","失谐双脉冲与三角波 · 慢起音铺底"};
    private static final int[] RETRO_GM={80,80,38,81,9,61,81,89};
    public static boolean isRetroGame(int id){return id>=RETRO_FIRST&&id<=RETRO_LAST;}
    private static final String[] NAMES = {
            "三角钢琴", "电钢琴", "八音盒", "管风琴",
            "柔和钢琴", "明亮钢琴", "木吉他", "弦乐",
            "长笛", "颤音琴", "合成垫", "羽管键琴",
            "立式钢琴", "爵士钢琴", "复古钢琴", "舞台电钢琴", "柔和计算器音", "清脆计算器音", "像素电子音", "弹跳电子音", "水晶叮咚",
            "经典蜂鸣", "复古方波", "窄脉冲", "数字按键", "八度电子", "明亮钟琴", "玻璃铃", "柔亮三角波",
            "电子鼓组", "小提琴", "中提琴", "大提琴", "低音提琴"
    };
    private static final String[] DETAILS = {
            "自然均衡", "柔亮颗粒", "清脆钟音", "绵长共鸣",
            "柔和温暖", "清亮有力", "木质拨弦", "舒缓弓弦",
            "轻柔气息", "金属颤音", "渐入铺底", "明快拨键",
            "贴近木质", "温暖厚实", "旧琴颗粒", "清亮电音", "柔和滴滴声", "清亮滴滴声", "复古游戏声", "轻快弹性", "透明钟音",
            "纯净持续滴声", "空心复古蜂鸣", "纤细鼻音脉冲", "短促清脆按键", "明亮八度叠音", "金属高频钟音", "轻颤玻璃共鸣", "圆润微颤电子音",
            "十六种合成击打声", "明亮独奏弓弦", "温厚中音弓弦", "低音木质共鸣", "深沉低频弓弦"
    };
    // Zero-based General MIDI programs; target players choose their own samples.
    private static final int[] GM = {0, 4, 10, 19, 0, 1, 24, 48, 73, 11, 89, 6, 0, 0, 3, 5, 80, 80, 81, 82, 10,
            80, 80, 80, 82, 80, 9, 14, 80, 0, 40, 41, 42, 43};
    private static final String[] GM_NAMES = {"采样三角钢琴", "采样亮音钢琴", "电声三角钢琴", "酒吧钢琴", "采样电钢琴一", "采样电钢琴二", "采样羽管键琴", "击弦古钢琴", "钢片琴", "采样钟琴", "采样八音盒", "采样颤音琴", "马林巴", "木琴", "管钟", "扬琴", "拉杆风琴", "打击风琴", "摇滚风琴", "教堂管风琴", "簧风琴", "手风琴", "口琴", "探戈手风琴", "尼龙弦吉他", "钢弦吉他", "爵士电吉他", "清音电吉他", "闷音电吉他", "过载电吉他", "失真电吉他", "吉他泛音", "原声贝斯", "指弹电贝斯", "拨片电贝斯", "无品贝斯", "击弦贝斯一", "击弦贝斯二", "合成贝斯一", "合成贝斯二", "采样小提琴", "采样中提琴", "采样大提琴", "采样低音提琴", "弦乐颤弓", "弦乐拨奏", "竖琴", "定音鼓", "弦乐合奏一", "弦乐合奏二", "合成弦乐一", "合成弦乐二", "合唱啊声", "合唱唔声", "合成人声", "乐队齐奏", "小号", "长号", "大号", "弱音小号", "圆号", "铜管合奏", "合成铜管一", "合成铜管二", "高音萨克斯", "中音萨克斯", "次中音萨克斯", "上低音萨克斯", "双簧管", "英国管", "巴松管", "单簧管", "短笛", "采样长笛", "竖笛", "排箫", "吹瓶", "尺八", "哨笛", "陶笛", "方波主音", "锯齿主音", "汽笛主音", "呼吸主音", "木质主音", "人声主音", "五度主音", "贝斯加主音", "新世纪铺底", "温暖铺底", "复音铺底", "合唱铺底", "弓弦铺底", "金属铺底", "光环铺底", "扫频铺底", "雨滴效果", "电影效果", "水晶效果", "气氛效果", "明亮效果", "精灵效果", "回声效果", "科幻效果", "西塔琴", "班卓琴", "三味线", "筝", "卡林巴", "风笛", "古提琴", "唢呐", "叮当铃", "阿哥哥铃", "钢鼓", "木鱼", "太鼓", "旋律通鼓", "合成鼓", "反向镲", "吉他摩擦", "呼吸声", "海岸声", "鸟鸣", "电话铃", "直升机", "掌声", "枪声"};
    public static final String[] CATEGORIES={"原有音色","钢琴","键盘打击","风琴","吉他","贝斯","弦乐","合奏人声","铜管","萨克斯木管","笛类","合成主音","铺底","氛围效果","民族乐器","打击乐","环境效果","复古游戏","游戏口琴"};
    public static boolean isSampled(int id){return id>=34&&id<162;}
    /** Prefer the complete recorded sound name over shorter legacy substrings. */
    public static int recordedPreset(String subtitle){int found=-1,length=0;if(subtitle==null)return -1;for(int i=0;i<count();i++){String name=name(i);if(name.length()>length&&subtitle.contains(name)){found=i;length=name.length();}}return found;}
    public static int category(int id){return isDeltaHarmonica(id)?18:isRetroGame(id)?17:isSampled(id)?1+(id-34)/8:0;}
    private Instruments() {}
    public static int count() { return 176; }
    public static int clamp(int id) { return Math.max(0, Math.min(DELTA_LAST, id)); }
    public static String name(int id) { id=clamp(id);return isDeltaHarmonica(id)?DELTA_NAMES[id-DELTA_FIRST]:isRetroGame(id)?RETRO_NAMES[id-RETRO_FIRST]:isSampled(id)?GM_NAMES[id-34]:NAMES[id]; }
    public static String detail(int id) { id=clamp(id);return isDeltaHarmonica(id)?"独立簧片合成 · 按住持续，松手收音":isRetroGame(id)?RETRO_DETAILS[id-RETRO_FIRST]:isSampled(id)?"真实采样 · "+CATEGORIES[category(id)]:DETAILS[id]; }
    public static int gmProgram(int id) { id=clamp(id);return isDeltaHarmonica(id)?22:isRetroGame(id)?RETRO_GM[id-RETRO_FIRST]:isSampled(id)?id-34:GM[id]; }
    public static boolean isPercussion(int id) { return clamp(id)==DRUM_KIT; }
    public static boolean isElectronic(int id) { return isRetroGame(id) || id>=16 && id<=28 || isSampled(id)&&gmProgram(id)>=80&&gmProgram(id)<=103; }
    public static boolean isPiano(int id) {
        int sound = clamp(id);
        return isSampled(sound)?gmProgram(sound)<8:sound == 0 || sound == 1 || sound == 4 || sound == 5 || (sound >= 12 && sound <= 15);
    }
}
