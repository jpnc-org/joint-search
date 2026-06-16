import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, FileText, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  GlassCard, Sparkle,
  EyebrowPill, NodeGraphBackground, FloatingSparkles,
  BeforeAfter, SlippyWords, WordRoll,
} from 'performative-ui';
import { useAuth } from '@/contexts/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <NodeGraphBackground
        className="pointer-events-none absolute inset-0 h-full w-full"
        density={50}
        baseOpacity={0.35}
        hoverDistance={0}
      />
      <FloatingSparkles
        className="pointer-events-none absolute inset-0 h-full w-full"
        count={14}
        sizeRange={[8, 16]}
        durationS={[12, 24]}
      />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkle /> DeepResearch
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Button onClick={() => navigate('/chat')} size="sm" className="cursor-pointer">
                Open Chat <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                <Button onClick={() => navigate('/login')} variant="ghost" size="sm" className="cursor-pointer">Sign in</Button>
                <Button onClick={() => navigate('/register')} size="sm" className="cursor-pointer">Get started</Button>
              </>
            )}
          </div>
        </nav>

        {/* Hero */}
        <section className="mx-auto flex max-w-5xl flex-col items-center px-6 pt-40 pb-32 text-center">
          <h1 className="flex flex-wrap items-baseline justify-center gap-x-3 pb-2 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            <span>Stop guessing.</span>
            <span>Start</span>
            <WordRoll
              words={['verifying.', 'fact-checking.', 'tracing sources.']}
              gradient
              intervalMs={2800}
            />
          </h1>

          <p className="mt-6 max-w-xl text-balance text-lg text-muted-foreground">
            Upload your knowledge base, enable web search or code execution, and get grounded answers with traceable sources.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Button onClick={() => navigate(user ? '/chat' : '/register')} size="lg" className="w-full cursor-pointer sm:w-auto">
              {user ? 'Open Chat' : 'Get started free'}
              <ArrowRight className="size-4" />
            </Button>
            <Button onClick={() => navigate(user ? '/knowledge-base' : '/login')} variant="outline" size="lg" className="w-full cursor-pointer sm:w-auto">
              {user ? 'Knowledge Base' : 'Sign in'}
            </Button>
          </div>
        </section>

        {/* SlippyWords */}
        <section className="py-16">
          <SlippyWords
            className="w-full"
            intensity={100}
            fade
            rows={[
              [
                'Fact-Checking',
                'Web Search',
                'Document Analysis',
                'RAG',
                'Deep Research',
                'Citations',
                'Source Tracing',
                'Grounded Answers',
                'Code Interpreter',
              ],
              [
                'File Mentions',
                'Knowledge Base',
                'No Hallucinations',
                'Per-conversation Toggles',
                'Multi-hop Reasoning',
                'Inline Sources',
                'Tag Filtering',
                'Nested Folders',
                'SSE Streaming',
              ],
            ]}
          />
        </section>

        {/* Before / After */}
        <section className="mx-auto max-w-4xl px-6 py-32">
          <div className="mb-10 text-center">
            <EyebrowPill icon={false} className="mb-4">The difference</EyebrowPill>
            <h2 className="text-3xl font-bold tracking-tight">
              Every claim, backed by evidence
            </h2>
          </div>

          <BeforeAfter
            beforeLabel="Without DeepResearch"
            afterLabel="With DeepResearch"
            brand="DeepResearch"
            before={[
              'LLM might hallucinate facts',
              'No citations or source links',
              'Information may be outdated',
              'No way to verify claims',
            ]}
            after={[
              'Every claim cross-checked against your documents',
              'Inline citations you can click through',
              'Live web search fills knowledge gaps',
              'Fact-check verdicts on every statement',
            ]}
          />
        </section>

        {/* Knowledge base section */}
        <section className="mx-auto max-w-5xl px-6 py-32">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
                <Layers className="size-7 text-primary" /> Knowledge Base
              </h2>
              <p className="mt-3 text-muted-foreground">
                Create nested folders. Tag files for cross-referencing. Group documents into knowledge bases. Mention any file or tag by name in chat to pull context instantly.
              </p>
            </div>
            <GlassCard className="p-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-4">
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm">research-paper.pdf</span>
                  <span className="ml-auto text-xs text-muted-foreground">2.4MB</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-4">
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm">dataset.csv</span>
                  <span className="ml-auto text-xs text-muted-foreground">890KB</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary/60 p-4">
                  <FileText className="size-8 text-primary" />
                  <span className="text-sm">notes.md</span>
                  <span className="ml-auto text-xs text-muted-foreground">12KB</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center px-6 py-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkle solid /> DeepResearch
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
