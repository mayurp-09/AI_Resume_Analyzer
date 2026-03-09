import { useState, useEffect } from "react";
import constants, {
  buildPresenceChecklist, METRIC_CONFIG, 
} from  "../constants.js";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function App() {
  const [aiReady, setAiReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [presenceChecklist, setPresenceChecklist] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (window.puter?.ai?.chat){
        setAiReady(true);
        clearInterval(interval);
      }
    }, 300);
    return () => clearInterval(interval);
  }, []);

  const extractPDFText = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const texts = await Promise.all(
      Array.from({length: pdf.numPages}, (_, i) => pdf.getPage(i+1).then(
        (page) => page.getTextContent().then((tc) => tc.items.map((i) => i.str).join(" "))
      ))
    );
    return texts.join("\n").trim();
  };

  const parseJSONResponse = (reply) => {
    try {
      const match = reply.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      if(!parsed.overallScore && !parsed.error) throw new Error("Invalid AI Response"); 
      return parsed;
    } catch (err) {
      throw new Error(`failed to parseAi response: ${err.message}`);
    }
  };

  const analyzeResume = async (text) => {
    const prompt = constants.ANALYZE_RESUME_PROMPT.replace("{{DOCUMENT_TEXT}}", text);
    const response = await window.puter.ai.chat([
      {role: "system", content: "You are an expert resume reviewer..."},
      {role : "user", content: prompt},
    ], { model : "gpt-4o" });
    const result = parseJSONResponse(typeof response === "string" ? response : response.message?.content || "");
    if(result.error) throw new Error(result.error);
    return result;
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if(!file || file.type !== "application/pdf") return alert("Please upload a PDF file only.");
    setUploadedFile(file);
    setIsLoading(true);
    try {
      const text = await extractPDFText(file);
      setResumeText(text);
      setPresenceChecklist(buildPresenceChecklist(text));
      setAnalysis(await analyzeResume(text));
    } catch(err) {
      alert(`Error: ${err.message}`);
      reset();
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setUploadedFile(null);
    setAnalysis(null);
    setResumeText("");
    setPresenceChecklist([]);
  };

  return (
    <div className="min-h-screen bg-main-gradient p-6 lg:p-10 text-slate-200">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* PAGE 1: ENTRY PAGE */}
        {!uploadedFile && !isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
            <h1 className="text-5xl md:text-8xl font-black mb-10 bg-gradient-to-b from-white to-slate-600 bg-clip-text text-transparent tracking-tighter uppercase">
              AI Resume Analyzer
            </h1>
            <div className="glass-panel p-1 rounded-3xl">
              <input type="file" accept=".pdf" onChange={handleFileUpload} disabled={!aiReady} className="hidden" id="file-upload" />
              <label htmlFor="file-upload" className="btn-neon-lg cursor-pointer block">
                CHOOSE PDF RESUME
              </label>
            </div>
            <p className="mt-8 text-slate-600 font-mono text-xs uppercase tracking-[0.4em]">• PDF files only • Get instant analysis</p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="loader-neon mb-6"></div>
            <h2 className="text-2xl font-black text-cyan-400 animate-pulse tracking-widest uppercase">Analyzing Experience...</h2>
          </div>
        )}

        {/* PAGE 2: ANALYSIS RESULTS */}
        {analysis && uploadedFile && (
          <div className="space-y-6 animate-in">
            
            {/* NEW TOP HEADER: Title, Status, and Reset Button in one row */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 glass-card p-6 px-10 border-b-2 border-b-cyan-500/30">
              <div className="text-center md:text-left">
                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">AI Resume Analyzer</h1>
                <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.2em] mt-1 italic">Analysis Complete ✓</p>
              </div>
              <button onClick={reset} className="btn-neon-sm py-3 px-8">New Analysis</button>
            </div>

            {/* Row 1: Score & Summary */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4 glass-card p-6 flex flex-col items-center justify-center border-t-2 border-t-purple-500">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 text-center w-full">Overall Score</span>
                <div className="text-8xl font-black text-white leading-none mb-4">{analysis.overallScore || "0"}</div>
                
                <div className={`inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-neon ${
                  parseInt(analysis.overallScore) >= 8 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                  : parseInt(analysis.overallScore) >= 6 ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  <span>
                    {parseInt(analysis.overallScore) >= 8 ? "✨ Excellent"
                    : parseInt(analysis.overallScore) >= 6 ? "⭐ Good"
                    : "⬆️ Need Improvement"}
                  </span>
                </div>

                <div className="w-full h-1 bg-white/10 rounded-full">
                  <div className="h-full bg-cyan-400 shadow-[0_0_10px_#22d3ee] transition-all duration-1000" 
                       style={{width: `${(parseInt(analysis.overallScore)/10)*100}%`}}></div>
                </div>
              </div>

              <div className="md:col-span-8 glass-card p-8 bg-gradient-to-br from-white/[0.03] to-transparent flex flex-col justify-center">
                <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4">✍ Executive Summary</h4>
                <p className="text-slate-300 leading-relaxed font-light italic text-lg">"{analysis.summary}"</p>
              </div>
            </div>

            {/* Row 2: Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card-green p-8 border-l-4 border-l-emerald-500">
                <h4 className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-4">✔ Top Strengths</h4>
                <ul className="space-y-4">
                  {analysis.strengths?.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-slate-200 bg-white/5 p-3 rounded-xl">
                      <span className="text-emerald-500">▶</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass-card-orange p-8 border-l-4 border-l-orange-500">
                <h4 className="text-orange-400 text-xs font-black uppercase tracking-widest mb-4">⚡ Main Improvements</h4>
                <ul className="space-y-4">
                  {analysis.improvements?.slice(0,3).map((imp, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm font-medium text-slate-200 bg-white/5 p-3 rounded-xl">
                      <span className="text-orange-500">⚡</span> {imp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Row 3: Performance & ATS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              <div className="glass-card p-8 flex flex-col">
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-8 border-b border-white/5 pb-2">📊 Performance Metrics</h4>
                <div className="space-y-6 flex-grow flex flex-col justify-around">
                  {METRIC_CONFIG.map((cfg, i) => {
                    const val = analysis.performanceMetrics?.[cfg.key] ?? 5;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-[11px] text-slate-500 mb-2 uppercase font-black">
                          <span>{cfg.label}</span>
                          <span>{val}/10</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${cfg.colorClass} shadow-neon`} style={{width: `${val*10}%`}}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="glass-card p-8 flex flex-col">
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-8 border-b border-white/5 pb-2">🤖 ATS Optimization</h4>
                <div className="grid grid-cols-1 gap-3 flex-grow">
                  {presenceChecklist.map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-4 rounded-xl border text-[11px] font-black tracking-widest uppercase ${item.present ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-red-500/10 border-red-500/20 text-red-400 opacity-60"}`}>
                      <span>{item.label}</span>
                      <span>{item.present ? "PASSED" : "FAILED"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 4: Insights */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card p-8 border-t-4 border-t-violet-500">
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-6">🎯 Action Items</h4>
                <div className="space-y-4 text-sm text-slate-300 font-medium">
                  {analysis.actionItems?.slice(0,5).map((a, i) => (
                    <div key={i} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">• {a}</div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-8 border-t-4 border-t-cyan-500">
                <h4 className="text-sm font-black text-white uppercase tracking-widest mb-6">💡 Pro Tips</h4>
                <div className="space-y-4 text-sm text-slate-300 font-medium">
                  {analysis.proTips?.slice(0,5).map((t, i) => (
                    <div key={i} className="flex gap-3 bg-white/5 p-3 rounded-xl border border-white/5">⚡ {t}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 5: Keywords Full Width */}
            <div className="glass-card p-8 border-b-4 border-b-cyan-500 mb-20">
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-8">🗝️ Recommended Keywords</h4>
              <div className="flex flex-wrap gap-3">
                {analysis.keywords?.map((k, i) => (
                  <span key={i} className="px-5 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-xs font-black text-cyan-300 rounded-xl uppercase tracking-wider hover:bg-cyan-500 hover:text-black transition-all">
                    {k}
                  </span>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

export default App;