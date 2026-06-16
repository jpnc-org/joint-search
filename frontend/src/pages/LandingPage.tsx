import { useNavigate } from 'react-router-dom';
import {
  Upload, Tag, MessageSquare, ArrowRight, FileText, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Rotator, GlassCard, Sparkle, GradientText,
  EyebrowPill, Aurora, MockIDE,
} from 'performative-ui';
import { useAuth } from '@/contexts/AuthContext';

const STEPS = [
  { icon: Upload, title: 'Upload', desc: 'Drag and drop files into your knowledge base.' },
  { icon: Tag, title: 'Tag', desc: 'Organize with folders and tags for quick reference.' },
  { icon: MessageSquare, title: 'Chat', desc: 'Mention files, toggle capabilities, get answers.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Aurora className="pointer-events-none absolute inset-0 h-full w-full opacity-40" />

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
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-20 pb-24 text-center">
          <div className="mb-6 text-lg text-muted-foreground">You can</div>

          <h1 className="flex h-16 items-center justify-center text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            <GradientText>
              <Rotator
                words={['fact-check.', 'deep-research.', 'verify claims.', 'trace sources.']}
                hideCursor={false}
              />
            </GradientText>
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

        {/* How it works */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-12 text-center">
            <EyebrowPill className="mb-4">Workflow</EyebrowPill>
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

        {/* Code interpreter demo */}
        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="mb-8 text-center">
            <EyebrowPill className="mb-4">Code Interpreter</EyebrowPill>
            <h2 className="text-3xl font-bold tracking-tight">Verify data with executable code</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Run calculations, generate charts, and test hypotheses directly in chat.
            </p>
          </div>
          <MockIDE className="rounded-xl" />
        </section>

        {/* Knowledge base section */}
        <section className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <EyebrowPill className="mb-4"><Layers className="size-5" /> Knowledge Base</EyebrowPill>
              <h2 className="text-2xl font-bold tracking-tight">
                Organize your research, not just consume it
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
