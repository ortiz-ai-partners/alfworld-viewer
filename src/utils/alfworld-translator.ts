export interface ALFStep {
    obs: string;
    act: string;
    thought?: string;
}

export interface ALFEpisode {
    id: string;
    steps: ALFStep[];
    goal: string;
    success: boolean;
    init_prompt?: string;
}

const locationMap: Record<string, string> = {
    countertop: "カウンター",
    cabinet: "キャビネット",
    fridge: "冷蔵庫",
    microwave: "電子レンジ",
    sink: "シンク",
    stoveburner: "コンロ",
    toaster: "トースター",
    table: "テーブル",
    drawer: "引き出し",
    shelf: "棚",
    sofa: "ソファ",
    bed: "ベッド",
    desk: "デスク",
    dresser: "タンス",
    toilet: "トイレ",
    bathtub: "浴槽",
    garbagecan: "ゴミ箱",
    sidetable: "サイドテーブル",
    armchair: "アームチェア",
    coffeetable: "コーヒーテーブル",
    safe: "金庫",
    coffeemachine: "コーヒーメーカー",
    sinkbasin: "シンク",
    bathtubbasin: "浴槽",
};

const objectMap: Record<string, string> = {
    "the": "それ",
    apple: "リンゴ",
    bread: "パン",
    cup: "カップ",
    plate: "お皿",
    knife: "ナイフ",
    fork: "フォーク",
    spoon: "スプーン",
    bowl: "ボウル",
    mug: "マグカップ",
    egg: "卵",
    potato: "ジャガイモ",
    tomato: "トマト",
    lettuce: "レタス",
    laptop: "ノートパソコン",
    cellphone: "携帯電話",
    remotecontrol: "リモコン",
    book: "本",
    newspaper: "新聞",
    soapbar: "石鹸",
    toothbrush: "歯ブラシ",
    toothpaste: "歯磨き粉",
    towel: "タオル",
    candle: "キャンドル",
    pan: "フライパン",
    pot: "鍋",
    glassbottle: "瓶",
    winebottle: "ワインボトル",
    wateringcan: "ジョウロ",
    statue: "像",
    vase: "花瓶",
    houseplant: "観葉植物",
    peppershaker: "コショウ入れ",
    saltshaker: "塩入れ",
    keychain: "キーホルダー",
    watch: "時計",
    creditcard: "クレジットカード",
    pencil: "鉛筆",
    pen: "ペン",
    soap: "石鹸",
    desklamp: "卓上ランプ",
    lightswitch: "スイッチ",
};

function stripId(name: string): string {
    if (!name) return "";
    let clean = name.toLowerCase().trim();
    // Remove punctuation from the word itself
    clean = clean.replace(/[.,;]/g, '');
    // More aggressive cleaning for articles and numeric suffixes
    clean = clean
        .replace(/^(the|a|an|some)\s*/g, '')
        .replace(/(\s|_)?\d+$/g, '')
        .replace(/\s+/g, '')
        .trim();
    return clean;
}

function getJa(name: string, map: Record<string, string>): string {
    const clean = stripId(name);
    // Even more aggressive: if the clean name contains a known key, use it
    const key = Object.keys(map).find(k => clean.includes(k));
    if (key) return map[key];
    return map[clean] || name;
}

function pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

export function translateAction(step: ALFStep, agentName: string): string {
    const action = step.act;
    if (!action || action === "start" || action === "look" || action.includes("task succeeded")) return "";

    let cleanAction = action;
    let thought = step.thought || "";

    if (action.includes("THOUGHT:")) {
        const parts = action.split(/ACTION:|Action:/i);
        const extractedThought = parts[0].replace(/THOUGHT:|Thought:/i, "").trim();
        if (extractedThought && !thought.includes(extractedThought)) {
            thought = extractedThought + (thought ? " " + thought : "");
        }
        cleanAction = (parts[1] || "").trim() || action;
    } else if (action.includes("ACTION:")) {
        cleanAction = action.split(/ACTION:/i)[1].trim();
    }

    let result = "";
    if (thought) {
        const cleanThought = thought
            .replace(/I should /gi, "")
            .replace(/I will /gi, "")
            .replace(/First, /gi, "")
            .replace(/Now /gi, "")
            .replace(/I need to /gi, "");
        result += `（心の声: ${cleanThought}）\n`;
    }

    const head = cleanAction.split(" ")[0].toLowerCase();

    if (head === "go" && cleanAction.includes("to")) {
        const locPart = cleanAction.split(/ to /i)[1] || "";
        const loc = getJa(locPart, locationMap);
        return result + pickRandom([
            `${agentName}はゆっくりと${loc}の方へ歩いていきました。`,
            `${agentName}は${loc}まで移動することにしました。`,
            `${agentName}はとぼとぼと${loc}へ向かいました。`
        ]);
    }

    if (head === "take" || head === "pick") {
        const fromSplit = cleanAction.split(/ from | in | on /i);
        const objPart = fromSplit[0].replace(/take |pick up /i, "").trim();
        const locPart = fromSplit[1] || "";
        const obj = getJa(objPart, objectMap);
        const loc = locPart ? getJa(locPart, locationMap) : "";
        const locStr = loc ? `${loc}にある` : "";
        return result + pickRandom([
            `${locStr}${obj}を手に取りました。`,
            `${locStr}${obj}をそっと持ち上げました。`,
            `${locStr}${obj}を確保しました。よし。`
        ]);
    }

    if (head === "put" || head === "move") {
        const toSplit = cleanAction.split(/ in | on | to /i);
        const objPart = toSplit[0].replace(/put |move /i, "").trim();
        const locPart = toSplit[1] || "";
        const obj = getJa(objPart, objectMap);
        const loc = getJa(locPart, locationMap);

        if (cleanAction.includes("two")) {
            return result + `２ついれるんだ！ ${obj}を${loc}に。`;
        }

        const verb = head === "move" ? "動かすことにしました" : "置きました";
        return result + pickRandom([
            `${agentName}は${obj}を${loc}へ${verb}。`,
            `大事に持っていた${obj}を${loc}に${verb}。`,
            `${obj}を${loc}に配置完了です。`
        ]);
    }

    if (head === "clean") {
        const objPart = cleanAction.replace(/clean /i, "").split(/ with /i)[0];
        const obj = getJa(objPart, objectMap);
        return result + pickRandom([
            `${obj}を丁寧に洗い、きれいにしました。`,
            `${obj}の汚れを落としてピカピカにしました。`,
            `${obj}をきれいに掃除しました。気持ちいい！`
        ]);
    }

    if (head === "heat") {
        const objPart = cleanAction.replace(/heat /i, "").split(/ with /i)[0];
        const obj = getJa(objPart, objectMap);
        return result + pickRandom([
            `${obj}を温めました。ホカホカです。`,
            `${obj}を電子レンジやコンロを使って温めました。`,
            `${obj}がいい感じに温まったようです。`
        ]);
    }

    if (head === "cool") {
        const objPart = cleanAction.replace(/cool /i, "").split(/ with /i)[0];
        const obj = getJa(objPart, objectMap);
        return result + pickRandom([
            `${obj}を冷やしました。ひんやりとしています。`,
            `${obj}を冷蔵庫などで冷やしました。`,
            `${obj}が十分に冷たくなったようです。`
        ]);
    }

    if (head === "examine") {
        const objPart = cleanAction.replace(/examine /i, "");
        const obj = getJa(objPart, objectMap);
        return result + pickRandom([
            `これは${obj}だね。${agentName}はじっくりと観察しました。`,
            `これは${obj}だね。何か異常がないかジロジロ見ました。`,
            `これは${obj}だね。詳しく調べてみました。`
        ]);
    }

    if (head === "open") {
        const objPart = cleanAction.replace(/open /i, "");
        const obj = getJa(objPart, locationMap);
        return result + pickRandom([
            `${obj}を静かに開けました。`,
            `${obj}の中身を確認するために開けました。`,
            `${obj}の扉を引きました。`
        ]);
    }

    if (head === "close") {
        const objPart = cleanAction.replace(/close /i, "");
        const obj = getJa(objPart, locationMap);
        return result + pickRandom([
            `${obj}を閉めることにしたのは、${agentName}でした。`,
            `${obj}を閉めることにしたのは、次へ進むためです。`,
            `${obj}をパタンと閉じました。`
        ]);
    }

    if (head === "turn") {
        const objPart = cleanAction.replace(/turn on |turn off /i, "");
        const obj = getJa(objPart, objectMap);
        const isOn = cleanAction.toLowerCase().includes("on");
        if (isOn && (objPart.includes("lamp") || objPart.includes("light"))) {
            return result + `${obj}の明かりをともす。`;
        }
        const state = isOn ? "スイッチを入れました。" : "スイッチを切りました。";
        return result + `${obj}の${state}`;
    }

    return result + `${agentName}は「${cleanAction}」という行動をとりました。`;
}

export function translateObservation(obs: string, agentName: string): string {
    if (!obs) return "";

    // Split into sentences because real logs often concatenate them (sometimes without spaces)
    const sentences = obs.split(/[.!?]\s*/).filter(s => s.trim().length > 0);
    const translatedSentences = sentences.map(sentence => {
        const s = sentence.trim();
        const lowerS = s.toLowerCase();

        if (lowerS.includes("middle of a room")) {
            return pickRandom([
                `${agentName}は部屋の中央で立ち止まり、周囲を見渡しました。`,
                `${agentName}は部屋の真ん中にいます。何から始めようかな。`,
                `${agentName}は部屋の中心に立ち、作戦を練っています。`
            ]);
        }

        if (lowerS.includes("nothing happens") || lowerS.includes("nothing happened") || lowerS === "nothing") {
            return "特に何もない事実。";
        }

        if (lowerS.includes("arrive at") || lowerS.includes("are at")) {
            const locPart = s.split(/arrive at |are at /i)[1] || s;
            const loc = getJa(locPart, locationMap);
            return pickRandom([
                `${loc}に到着しました。`,
                `${loc}にたどり着いたようです。`,
                `${loc}の前まで来ました。`
            ]);
        }

        if (lowerS.includes("you see") || lowerS.includes("can see") || lowerS.includes("yousee")) {
            const itemsPart = s.split(/see |cansee /i)[1] || s;
            const items = itemsPart.split(/, | and |and/i).map(i => getJa(i, objectMap)).filter(Boolean).join("、");
            return pickRandom([
                `${items}が見えました。`,
                `そこには${items}があるようです。`,
                `周囲をよく見ると${items}を発見しました。`
            ]);
        }

        if (lowerS.includes("on the")) {
            // handle "on the cabinet 1, you see a mug 2"
            const locPart = s.split(/on the /i)[1]?.split(/, | yousee | you see/i)?.[0] || "";
            const itemsPart = s.split(/yousee |you see /i)[1] || "";
            const loc = getJa(locPart, locationMap);
            const items = itemsPart.split(/, | and |and/i).map(i => getJa(i, objectMap)).filter(Boolean).join("、");
            if (loc && items) return pickRandom([
                `${loc}の上を確認すると、${items}が置いてありました。`,
                `${loc}の上には、${items}が置かれているのがわかります。`,
                `${loc}を見ると、${items}が並んでいました。`
            ]);
        }

        if (lowerS.includes("open the") || lowerS.includes("openthe") || lowerS.includes("you open")) {
            const locPart = s.replace(/you open |openthe |open the /i, "").split(/[. ]/)[0];
            const loc = getJa(locPart, locationMap);
            if (lowerS.includes("nothing")) {
                return pickRandom([
                    `${loc}を開けましたが、中は空っぽでした。`,
                    `${loc}の中には何も入っていないようです。`,
                    `${loc}を覗きましたが、何も見つかりませんでした。`
                ]);
            }
            const itemsPart = s.split(/see |inside|there/i)[1] || "";
            const items = itemsPart.split(/, | and |and/i).map(i => getJa(i, objectMap)).filter(Boolean).join("、");
            if (items) return pickRandom([
                `${loc}を開けると、中には${items}が入っていました。`,
                `${loc}の内部には、${items}があるのを確認しました。`,
                `${loc}を開けたところ、${items}が見つかりました。`
            ]);
            return `${loc}を開けました。`;
        }

        if (lowerS.includes("is open") || lowerS.includes("isopen")) {
            const locPart = s.replace(/the |is open|isopen/gi, "").trim();
            const loc = getJa(locPart, locationMap);
            return `${loc}が開いています。`;
        }

        if (lowerS.includes("is closed") || lowerS.includes("isclosed")) {
            const locPart = s.replace(/the |is closed|isclosed/gi, "").trim();
            const loc = getJa(locPart, locationMap);
            return `${loc}が閉じています。`;
        }

        if (lowerS.includes("pick up")) {
            const parts = s.split(/from/i);
            const obj = getJa(parts[0].replace(/pick up |you /i, ""), objectMap);
            const loc = parts[1] ? getJa(parts[1], locationMap) : "";
            const locStr = loc ? `${loc}から` : "";
            return pickRandom([
                `${locStr}${obj}を持ち上げ、大切に抱えました。`,
                `${locStr}${obj}をひょいと持ち上げました。`,
                `${locStr}${obj}を手に入れました。`
            ]);
        }

        // Final generic clean for this chunk
        return s
            .replace(/You are at (.*)/gi, (_, p1) => `${getJa(p1, locationMap)}に到着しました。`)
            .replace(/You are in (.*)/gi, (_, p1) => `${getJa(p1, locationMap)}の中にいます。`)
            .replace(/You/g, agentName)
            .replace(/$/g, "。");
    });

    return translatedSentences.join(" ");
}

function getGoalRaw(episode: ALFEpisode): string {
    const e = episode as any;
    let goal = episode.goal || e.instruction || e.task || e.objective || e.goal_str || e.desc;

    if (!goal && episode.init_prompt) {
        const taskMatch = episode.init_prompt.match(/Your task is to: (.*?)\./);
        if (taskMatch) {
            goal = taskMatch[1];
        } else {
            const lines = episode.init_prompt.split('\n');
            const objectiveLine = lines.find(l => l.includes("Your task is to:"));
            if (objectiveLine) {
                goal = objectiveLine.replace("Your task is to:", "").trim();
            }
        }
    }
    return goal || "";
}

export function generateStory(episode: ALFEpisode, agentName: string): string[] {
    const story: string[] = [];
    const rawGoal = getGoalRaw(episode);

    let goalJa = (rawGoal || `エピソードログ (${episode.id})`)
        .replace(/put a/g, "〜を置く")
        .replace(/clean/g, "洗った")
        .replace(/heat/g, "温めた")
        .replace(/cool/g, "冷やした")
        .replace(/find/g, "見つける")
        .replace(/pick up/g, "拾い上げる")
        .replace(/look at/g, "眺める")
        .replace(/ in /g, "の中に ")
        .replace(/ on /g, "の上に ")
        .replace(/ to /g, "に ")
        .replace(/ and /g, "と ");

    Object.keys(objectMap).forEach(k => {
        const reg = new RegExp(`\\b${k}\\b`, 'gi');
        if (goalJa.includes(k)) goalJa = goalJa.replace(reg, objectMap[k]);
    });
    Object.keys(locationMap).forEach(k => {
        const reg = new RegExp(`\\b${k}\\b`, 'gi');
        if (goalJa.includes(k)) goalJa = goalJa.replace(reg, locationMap[k]);
    });

    story.push(`【成長の記録】: ${goalJa}`);

    if (episode.steps && Array.isArray(episode.steps)) {
        episode.steps.forEach((step) => {
            const actJa = translateAction(step, agentName);
            const obsJa = translateObservation(step.obs, agentName);

            if (actJa) story.push(actJa);
            if (obsJa && !obsJa.includes(agentName + "は「")) story.push(obsJa);
        });
    } else {
        story.push("（このエピソードにはステップの記録がありませんでした）");
    }

    if (episode.success) {
        story.push(`${agentName}は見事に目標を達成しました！一歩、成長したようです。`);
    } else {
        story.push(`${agentName}は今回は目標に届きませんでした。この経験が次への糧となるでしょう。`);
    }

    return story;
}
export function generateEnglishStory(episode: ALFEpisode): string[] {
    const story: string[] = [];

    const rawGoal = getGoalRaw(episode);
    story.push(`[Goal]: ${rawGoal || "No Goal Provided"}`);

    if (episode.steps && Array.isArray(episode.steps)) {
        episode.steps.forEach((step, index) => {
            if (step.thought) {
                story.push(`Step ${index + 1} Thought: ${step.thought}`);
            }
            if (step.act) {
                story.push(`Step ${index + 1} Action: ${step.act}`);
            }
            if (step.obs) {
                story.push(`Step ${index + 1} Observation: ${step.obs}`);
            }
        });
    } else {
        story.push("(No steps recorded in this episode)");
    }

    story.push(`Final Success Status: ${episode.success ? "SUCCESS" : "FAILURE"}`);
    return story;
}
