"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  Settings,
  ChevronDown,
  BookOpen,
  User,
  CheckCircle,
  XCircle,
  X,
  HelpCircle,
  Download,
  Terminal,
  FileCode,
  Languages,
  Smile
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  ALFEpisode,
  generateStory,
  generateEnglishStory
} from "@/utils/alfworld-translator";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [agentName, setAgentName] = useState("あるふ");
  const [episodes, setEpisodes] = useState<ALFEpisode[]>([]);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState<number>(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [displayLanguage, setDisplayLanguage] = useState<'ja' | 'en'>('ja');

  // Load agent name and language from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem("alfworld_agent_name");
    if (savedName) setAgentName(savedName);

    const savedLang = localStorage.getItem("alfworld_display_lang") as 'ja' | 'en';
    if (savedLang) setDisplayLanguage(savedLang);
  }, []);

  const saveAgentName = (name: string) => {
    setAgentName(name);
    localStorage.setItem("alfworld_agent_name", name);
  };

  const saveLanguage = (lang: 'ja' | 'en') => {
    setDisplayLanguage(lang);
    localStorage.setItem("alfworld_display_lang", lang);
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById('diary-card');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${agentName}_diary_${episodes[selectedEpisodeIndex].id}.pdf`);
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDFの作成に失敗しました。");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const fileArray = Array.from(files);
    let processedCount = 0;
    let anyValidData = false;

    // Helper to find data with 'steps' or 'history' recursively
    const extractEpisodes = (obj: any, parentStatus?: string, parentSuccess?: boolean): ALFEpisode[] => {
      let found: ALFEpisode[] = [];
      if (!obj || typeof obj !== 'object') return found;

      const currentStatus = obj.status || parentStatus;
      const currentSuccess = obj.success !== undefined ? !!obj.success : parentSuccess;

      // Handle ALFWorld episode detection
      // Prefer 'log' over 'history' for better structure
      const stepsRaw = obj.log || obj.steps || obj.history || obj.actions || obj.trajectory || obj.items;

      if (Array.isArray(stepsRaw) && stepsRaw.length > 0) {
        // Normalize steps
        const normalizedSteps = stepsRaw.map((step: any) => {
          if (step && typeof step === 'object') {
            let act = step.act || step.action || step.command || step.step || (step.role === 'agent' ? step.content : "");
            let obs = step.obs || step.observation || step.reward || step.result || (step.role === 'user' ? step.content : "");
            let thought = step.thought || step.reasoning || step.thinking || step.value || "";

            // User reported case: output/content field contains THOUGHT and ACTION
            const rawOutput = (step.output || step.content || step.result?.output || "");
            if (typeof rawOutput === 'string' && rawOutput.includes("THOUGHT:")) {
              const parts = rawOutput.split(/ACTION:|Action:/i);
              const extractedThought = parts[0].replace(/THOUGHT:|Thought:/i, "").trim();
              if (extractedThought) {
                thought = extractedThought;
              }
              const extractedAction = (parts[1] || "").trim();
              if (extractedAction) {
                act = extractedAction;
              }

              if (obs === rawOutput) {
                obs = "";
              }
            }

            return { act, obs, thought };
          }
          if (typeof step === 'string') {
            return { act: step, obs: "", thought: "" };
          }
          return null;
        }).filter(s => s !== null && (s.act || s.obs || s.thought));

        if (normalizedSteps.length > 0 || (obj.goal || obj.instruction || obj.task || obj.objective || obj.init_prompt)) {
          // Robust success detection
          const statusStr = currentStatus?.toString().toLowerCase().trim();
          const isSuccess = statusStr === "completed" ||
            statusStr === "success" ||
            currentSuccess ||
            obj.is_success === true ||
            obj.result === true ||
            obj.result === "success" ||
            obj.done === true ||
            (obj.reward !== undefined && Number(obj.reward) >= 1) ||
            (obj.last_reward !== undefined && Number(obj.last_reward) >= 1);

          const episode = {
            ...obj,
            steps: normalizedSteps,
            id: obj.id || obj.episode_id || obj.name || obj.session_id || `Ep-${Math.random().toString(36).substr(2, 5)}`,
            goal: obj.goal || obj.instruction || obj.task || obj.objective || obj.goal_str || obj.desc || "",
            success: isSuccess
          };
          found.push(episode as ALFEpisode);
          return found;
        }
      }

      if (Array.isArray(obj)) {
        obj.forEach(item => {
          found = [...found, ...extractEpisodes(item, currentStatus, currentSuccess)];
        });
        return found;
      }

      Object.keys(obj).forEach(key => {
        const val = (obj as any)[key];
        if (val && typeof val === 'object') {
          found = [...found, ...extractEpisodes(val, currentStatus, currentSuccess)];
        }
      });

      return found;
    };

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const rawContent = event.target?.result as string;
          let fileEpisodes: ALFEpisode[] = [];

          try {
            const json = JSON.parse(rawContent);
            fileEpisodes = extractEpisodes(json);
          } catch (e) {
            const lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            lines.forEach((line) => {
              try {
                const cleanLine = line.replace(/,$/, '').trim();
                const item = JSON.parse(cleanLine);
                const extracted = extractEpisodes(item);
                if (extracted.length > 0) {
                  fileEpisodes = [...fileEpisodes, ...extracted];
                }
              } catch (err) { }
            });
          }

          if (fileEpisodes.length > 0) {
            anyValidData = true;
            setEpisodes((prev) => [...prev, ...fileEpisodes]);
          }
        } catch (err) {
          console.error(`[ALFWorld] Error processing ${file.name}:`, err);
        } finally {
          processedCount++;
          if (processedCount === fileArray.length) {
            setIsUploading(false);
            if (!anyValidData) {
              alert("有効なエピソードが見つかりませんでした。");
            }
          }
        }
      };
      reader.readAsText(file);
    });
  };

  const currentEpisode = episodes[selectedEpisodeIndex];
  const story = currentEpisode ? (
    displayLanguage === 'ja'
      ? generateStory(currentEpisode, agentName)
      : generateEnglishStory(currentEpisode)
  ) : [];

  return (
    <div className="min-h-screen flex flex-col relative">
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="bg-card premium-card p-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary-main border-t-transparent rounded-full animate-spin" />
              <p className="font-serif italic text-xl">ペリーが日記を整理しています...</p>
              <p className="text-sm text-foreground/60 tracking-wider">少々お待ちください</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-30 w-full border-b border-border-main bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {episodes.length > 0 && (
              <div className="relative group">
                <select
                  className="appearance-none bg-card border border-border-main rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary-main text-sm font-medium"
                  value={selectedEpisodeIndex}
                  onChange={(e) => setSelectedEpisodeIndex(Number(e.target.value))}
                >
                  {episodes.map((ep, idx) => (
                    <option key={idx} value={idx}>
                      {ep.success ? "✅" : "😖"} エピソード {idx + 1}: {ep.id}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            )}
          </div>

          <h1 className="text-xl font-serif font-bold text-primary-main">
            {agentName}の成長記録
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center bg-secondary-soft rounded-lg p-1">
              <button
                onClick={() => saveLanguage('ja')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  displayLanguage === 'ja' ? "bg-primary-main text-white" : "text-muted-foreground hover:text-primary-main"
                )}
              >
                日
              </button>
              <button
                onClick={() => saveLanguage('en')}
                className={cn(
                  "px-3 py-1 text-xs font-bold rounded-md transition-all",
                  displayLanguage === 'en' ? "bg-primary-main text-white" : "text-muted-foreground hover:text-primary-main"
                )}
              >
                英
              </button>
            </div>

            <div className="h-6 w-px bg-border-main mx-1" />

            <button
              onClick={() => setIsHelpOpen(true)}
              className="p-2 rounded-full hover:bg-secondary-main transition-colors"
              title="使い方ガイド"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-full hover:bg-secondary-main transition-colors"
              title="設定"
            >
              <Settings className="w-5 h-5" />
            </button>
            <label className="p-2 rounded-full hover:bg-secondary-main transition-colors cursor-pointer" title="ログファイルを読み込む">
              <Upload className="w-5 h-5" />
              <input type="file" className="hidden" accept=".json" multiple onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <AnimatePresence mode="wait">
          {episodes.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4"
            >
              <div className="w-20 h-20 bg-secondary-main rounded-full flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-primary-main" />
              </div>
              <h2 className="text-2xl font-bold">まだ記録がありません</h2>
              <p className="text-gray-500 mb-6">
                ALFWorldの実行ログファイルをアップロードすると、エージェントの日記として読みやすく表示します。<br />
                JSONファイルをいれてください（JSONLも対応）。
              </p>
              <label className="mt-4 px-6 py-3 bg-primary-main text-white rounded-xl font-medium cursor-pointer hover:opacity-90 transition-opacity">
                記録を読み込む
                <input type="file" className="hidden" accept=".json" multiple onChange={handleFileUpload} />
              </label>
            </motion.div>
          ) : (
            <motion.div
              key={selectedEpisodeIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div id="diary-card" className="premium-card p-8 diary-paper relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 flex items-center gap-3">
                  <button
                    onClick={handleDownloadPDF}
                    className="p-2 rounded-full hover:bg-primary-soft text-primary-main transition-colors no-print"
                    title="PDFとして保存"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  {currentEpisode.success ? (
                    <div className="flex items-center gap-1 text-green-600 font-bold italic">
                      <CheckCircle className="w-5 h-5" /> Success
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-red-500 font-bold italic">
                      <XCircle className="w-5 h-5" /> Failed
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4">
                  {story.map((text, i) => (
                    <p key={i} className={cn(
                      "text-lg leading-relaxed whitespace-pre-line",
                      text.startsWith("【") || text.startsWith("[Goal]") ? "font-bold text-primary-main mb-6 underline decoration-primary-soft underline-offset-8" : ""
                    )}>
                      {text}
                    </p>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Help Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card w-full max-w-lg rounded-2xl shadow-xl border border-border-main p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-serif font-bold flex items-center gap-2 text-primary-main">
                  <HelpCircle className="w-6 h-6" /> 使い方ガイド
                </h3>
                <button onClick={() => setIsHelpOpen(false)} className="p-2 hover:bg-secondary-main rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <section className="space-y-3">
                  <h4 className="font-bold text-lg flex items-center gap-2 border-b border-primary-soft pb-2">
                    <Terminal className="w-5 h-5 text-primary-main" /> 記録を読み込む
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    右上の <Upload className="inline w-4 h-4" /> ボタンから、ALFWorldの実行ログ（JSONまたはJSONL形式）を選択してください。
                    複数のファイルを一気にまとめて読み込むことも可能です。
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-lg flex items-center gap-2 border-b border-primary-soft pb-2">
                    <Languages className="w-5 h-5 text-primary-main" /> 日/英の切り替え
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    ヘッダーの「日 / 英」スイッチで、エージェントの心情を交えた「日本語の物語」と、ログ原文に近い「英語表示」を即座に切り替えられます。
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-lg flex items-center gap-2 border-b border-primary-soft pb-2">
                    <Download className="w-5 h-5 text-primary-main" /> PDFでダウンロード
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    日記の右上にある <Download className="inline w-4 h-4" /> ボタンを押すと、今表示されている日記をそのままの可愛らしいデザインでPDFとして保存できます。
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-lg flex items-center gap-2 border-b border-primary-soft pb-2">
                    <Smile className="w-5 h-5 text-primary-main" /> エージェント名の変更
                  </h4>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <Settings className="inline w-4 h-4" /> 設定ボタンから、エージェントにお好きな名前（例：ペリー、アリスなど）をつけることができます。名前は日記のタイトルに反映されます。
                  </p>
                </section>

                <section className="space-y-3">
                  <h4 className="font-bold text-lg flex items-center gap-2 border-b border-primary-soft pb-2">
                    <FileCode className="w-5 h-5 text-primary-main" /> アイコンの意味
                  </h4>
                  <ul className="text-sm space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">✅ : エージェントが目標を最後まで達成できた記録です。</li>
                    <li className="flex items-center gap-2">😖 : 途中で行き詰まってしまった時の試行錯誤の記録です。</li>
                  </ul>
                </section>
              </div>

              <button
                onClick={() => setIsHelpOpen(false)}
                className="w-full mt-10 py-4 bg-primary-main text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                分かった！
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border-main p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <User className="w-5 h-5" /> 設定
                </h3>
                <button onClick={() => setIsSettingsOpen(false)} className="p-1 hover:bg-secondary-main rounded-full">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">エージェントの名前</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => saveAgentName(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary-main rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-main"
                    placeholder="エージェントの名前を入力..."
                  />
                  <p className="text-xs text-muted-foreground">ここで設定した名前がタイトルの「〇〇の成長記録」に反映されます。</p>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="w-full mt-8 py-3 bg-primary-main text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
              >
                保存して閉じる
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-6 border-t border-border-main bg-card mt-auto gap-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          &copy; 2026 ALFWorld Viewer - エージェントの成長記録
        </div>
      </footer>
    </div>
  );
}
