import { useNavigate } from 'react-router-dom';
import { Search, FileText, Globe, Code2, Brain, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Aurora, Rotator, GlassCard, StatCounter, Sparkle } from 'performative-ui';
import { useAuth } from '@/contexts/AuthContext';

const FEATURES = [
  { icon: Search, title: 'Deep Research', desc: 'Multi-step reasoning that follows citations to their source.' },
  { icon: ShieldCheck, title: 'Fact-Checking', desc: 'Cross-reference claims against your knowledge base in real time.' },
  { icon: FileText, title: 'RAG Knowledge Base', desc: 'Upload, tag, and organize documents for grounded answers.' },
  { icon: Globe, title: 'Web Search', desc: 'Pull live information from the web when your KB isn\u2019t enough.' },
  { icon: Code2, title: 'Code Interpreter', desc: 'Execute code in a sandbox to verify data and run calculations.' },
  { icon: Brain, title: 'RLM', desc: 'Retrieval-augmented language model pipeline for complex queries.' },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <Aurora animated className="absolute inset-0 h-full w-full" />

      <div className="relative z-10">
        {/* Nav */}
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Sparkle glyph="\u2726" /> DeepResearch
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
        <section className="mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 pb-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/50 px-4 py-1.5 text-xs text-muted-foreground">
            <span className="size-2 animate-pulse rounded-full bg-green-500" />
            Now generally available
          </div>

          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            <Rotator
              words={['fact-check.', 'deep-research.', 'verify claims.', 'trace sources.']}
              className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
              hideCursor={false}
              renderWord={(word) => (
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  {word}
                </span>
              )}
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
            <Button onClick={() => navigate('/login')} variant="outline" size="lg" className="w-full sm:w-auto">
              {user ? 'Knowledge Base' : 'Sign in'}
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 flex items-center gap-12">
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                <StatCounter target={27} durationMs={1500} />
              </div>
              <div className="text-xs text-muted-foreground">Components</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                <StatCounter target={4} durationMs={1200} />
              </div>
              <div className="text-xs text-muted-foreground">Capabilities</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-2xl font-bold text-foreground">
                <StatCounter target={100} durationMs={2000} format={(n) => `${n}%`} />
              </div>
              <div className="text-xs text-muted-foreground">Open source</div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-16">
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

        {/* CTA */}
        <section className="mx-auto max-w-4xl px-6 py-24 text-center">
          <Sparkle glyph="\u2726" className="mb-4 text-2xl" />
          <h2 className="text-3xl font-bold tracking-tight">
            Start researching smarter
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Create an account in seconds. No credit card required.
          </p>
          <Button
            onClick={() => navigate(user ? '/chat' : '/register')}
            size="lg"
            className="mt-8"
          >
            {user ? 'Open Chat' : 'Create free account'}
            <ArrowRight className="size-4" />
          </Button>
        </section>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Sparkle glyph="\u2726" solid /> DeepResearch
            </div>
            <div>Built with shadcn/ui & performative-ui</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
