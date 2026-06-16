import { useNavigate } from 'react-router-dom';
import {
  Search, FileText, Globe, Code2, Brain, ShieldCheck, ArrowRight,
  Upload, Tag, MessageSquare, CheckCircle2, Zap, Layers, Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Rotator, GlassCard, Sparkle, StatusDot, StatCounter,
  EyebrowPill, FloatingSparkles, NodeGraphBackground,
} from 'performative-ui';
import { useAuth } from '@/contexts/AuthContext';

const FEATURES = [
  { icon: Search, title: 'Deep Research', desc: 'Multi-step reasoning that follows citations to their source, builds context, and synthesizes findings.' },
  { icon: ShieldCheck, title: 'Fact-Checking', desc: 'Cross-reference claims against your knowledge base in real time. Every statement gets a verdict.' },
  { icon: FileText, title: 'RAG Knowledge Base', desc: 'Upload, tag, and organize documents. Mention files by name in chat to ground responses in your data.' },
  { icon: Globe, title: 'Web Search', desc: 'Pull live information from the web when your KB isn\u2019t enough. Toggle per-conversation.' },
  { icon: Code2, title: 'Code Interpreter', desc: 'Execute code in a sandbox to verify data, run calculations, and generate charts.' },
  { icon: Brain, title: 'RLM', desc: 'Retrieval-augmented language model pipeline for complex multi-hop queries.' },
];

const STEPS = [
  { icon: Upload, title: 'Upload', desc: 'Drag and drop files into your knowledge base.' },
  { icon: Tag, title: 'Tag', desc: 'Organize with folders and tags for quick reference.' },
  { icon: MessageSquare, title: 'Chat', desc: 'Mention files, toggle capabilities, get answers.' },
];

const CAPS = [
  { name: 'RAG', desc: 'Ground answers in your documents' },
  { name: 'Web Search', desc: 'Access live web information' },
  { name: 'Code Interpreter', desc: 'Run code to verify claims' },
  { name: 'RLM', desc: 'Advanced retrieval pipeline' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <FloatingSparkles className="pointer-events-none absolute inset-0 h-full w-full opacity-40" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkle /> DeepResearch
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => navigate('/chat')} size="sm">
                Open Chat <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} variant="ghost" size="sm">Sign in</Button>
                <Button onClick={() => navigate('/register')} size="sm">Get started</Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 pb-20 text-center">
          <EyebrowPill className="mb-6">
            <StatusDot /> AI-powered research platform
          </EyebrowPill>

          <h1 className="flex h-16 items-center justify-center text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            <Rotator
              words={['fact-check.', 'deep-research.', 'verify claims.', 'trace sources.']}
              hideCursor={false}
            />
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            A chat interface for LLM-powered research. Upload your knowledge base, enable web search or code execution, and get grounded answers with traceable sources.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button onClick={() => navigate(user ? '/chat' : '/register')} size="lg" className="w-full sm:w-auto">
              {user ? 'Open Chat' : 'Get started free'}
              <ArrowRight className="size-4" />
            </Button>
            <Button onClick={() => navigate(user ? '/knowledge-base' : '/login')} variant="outline" size="lg" className="w-full sm:w-auto">
              {user ? 'Knowledge Base' : 'Sign in'}
            </Button>
          </div>
        </section>

        {/* Stats bar */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <GlassCard className="flex items-center justify-around gap-4 p-8">
            <div className="text-center">
              <div className="text-3xl font-bold">
                <StatCounter target={6} durationMs={1200} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Capabilities</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold">
                <StatCounter target={50} durationMs={1500} format={(n) => `${n}MB`} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Max file size</div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold">
                <StatCounter target={4} durationMs={1000} />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">Toggles per chat</div>
            </div>
          </GlassCard>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Everything you need to research with confidence</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Toggle capabilities per conversation. Mention files by name. Get answers grounded in your data.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <GlassCard key={feature.title} className="p-6">
                <feature.icon className="mb-4 size-6 text-primary" />
                <h3 className="mb-2 font-semibold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-col items-center text-center">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
                  <step.icon className="size-5 text-primary" />
                </div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Step {i + 1}</div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Capabilities detail */}
        <section className="relative mx-auto max-w-6xl px-6 py-20">
          <NodeGraphBackground className="pointer-events-none absolute inset-0 h-full w-full opacity-30" />
          <div className="relative z-10">
            <div className="mb-12 text-center">
              <EyebrowPill className="mb-4">Per-conversation control</EyebrowPill>
              <h2 className="text-3xl font-bold tracking-tight">Toggle capabilities on your terms</h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                Each conversation gets its own set of enabled tools. You decide what the model can access.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {CAPS.map((cap) => (
                <GlassCard key={cap.name} className="flex items-center gap-4 p-5">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <CheckCircle2 className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{cap.name}</h3>
                    <p className="text-sm text-muted-foreground">{cap.desc}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* Knowledge base section */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <EyebrowPill className="mb-4"><Layers className="size-3" /> Knowledge Base</EyebrowPill>
              <h2 className="text-2xl font-bold tracking-tight">
                Organize your research, not just consume it
              </h2>
              <p className="mt-3 text-muted-foreground">
                Create nested folders. Tag files for cross-referencing. Group documents into knowledge bases. Mention any file or tag by name in chat to pull context instantly.
              </p>
              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <Database className="size-4 text-primary" /> Unlimited knowledge bases
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Tag className="size-4 text-primary" /> Tag files and folders
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <Zap className="size-4 text-primary" /> Mention by name in chat
                </li>
              </ul>
            </div>
            <GlassCard className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-secondary/60 p-3">
                  <FileText className="size-4 text-primary" />
                  <span className="text-sm">research-paper.pdf</span>
                  <span className="ml-auto text-xs text-muted-foreground">2.4MB</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary/60 p-3">
                  <FileText className="size-4 text-primary" />
                  <span className="text-sm">dataset.csv</span>
                  <span className="ml-auto text-xs text-muted-foreground">890KB</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-secondary/60 p-3">
                  <FileText className="size-4 text-primary" />
                  <span className="text-sm">notes.md</span>
                  <span className="ml-auto text-xs text-muted-foreground">12KB</span>
                </div>
                <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                  <StatusDot /> 3 files &middot; tagged: research, q4-2025
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Start researching smarter</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create an account in seconds. No credit card required.
          </p>
          <Button onClick={() => navigate(user ? '/chat' : '/register')} size="lg" className="mt-8">
            {user ? 'Open Chat' : 'Create free account'}
            <ArrowRight className="size-4" />
          </Button>
        </section>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkle solid /> DeepResearch
            </div>
            <div className="flex items-center gap-1.5">
              <StatusDot /> All systems operational
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
