import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform, useInView, useAnimation } from "framer-motion";
import { useAuth } from "@lib/auth/AuthContext";
import { Button } from "@components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { ImageWithFallback } from "@components/common/ImageWithFallback";
import { SimpleThemeToggle } from "@components/common/ThemeToggle";
import { 
  BarChart3, 
  Wallet, 
  Target, 
  TrendingUp, 
  Shield,
  Sparkles,
  Zap,
  ArrowRight,
  Play,
  CheckCircle,
  Star,
  ArrowUpRight,
  Globe,
  Smartphone,
  Users
} from "lucide-react";

const AnimatedText = ({ children, className = "", delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => {
  const controls = useAnimation();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start("visible");
    }
  }, [controls, inView]);

  return (
    <motion.div
      ref={ref}
      animate={controls}
      initial="hidden"
      variants={{
        hidden: { opacity: 0, y: 50 },
        visible: { 
          opacity: 1, 
          y: 0,
          transition: { duration: 0.6, delay, ease: "easeOut" }
        }
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

const FloatingCard = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60, scale: 0.8 }}
      animate={inView ? { 
        opacity: 1, 
        y: 0, 
        scale: 1,
        transition: { 
          duration: 0.8, 
          delay,
          ease: [0.16, 1, 0.3, 1],
          type: "spring",
          stiffness: 100
        }
      } : {}}
      whileHover={{ 
        y: -8, 
        scale: 1.02,
        transition: { duration: 0.2 }
      }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
};

const ParallaxSection = ({ children, offset = 50 }: { children: React.ReactNode, offset?: number }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });
  const y = useTransform(scrollYProgress, [0, 1], [offset, -offset]);

  return (
    <motion.div ref={ref} style={{ y }}>
      {children}
    </motion.div>
  );
};

export function LandingPage() {
  const { signInDemo } = useAuth();
  const navigate = useNavigate();
  const handleGetStarted = () => {
    void (async () => {
      await signInDemo();
      navigate("/app/dashboard");
    })();
  };

  const [, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });
  
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);

  const features = [
    {
      icon: <Wallet className="h-8 w-8 text-primary" />,
      title: "Smart Transaction Tracking",
      description: "AI-powered categorization with real-time sync across all your accounts. Never miss a transaction again.",
      gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: <Target className="h-8 w-8 text-primary" />,
      title: "Intelligent Budgeting",
      description: "Dynamic budget adjustments based on your spending patterns. Get alerts before you overspend.",
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: <BarChart3 className="h-8 w-8 text-primary" />,
      title: "Advanced Analytics",
      description: "Deep insights into your financial habits with predictive analytics and personalized recommendations.",
      gradient: "from-orange-500/20 to-red-500/20"
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Bank-Grade Security",
      description: "256-bit encryption, biometric authentication, and fraud protection keep your data safe.",
      gradient: "from-green-500/20 to-emerald-500/20"
    },
    {
      icon: <Smartphone className="h-8 w-8 text-primary" />,
      title: "Mobile-First Design",
      description: "Native iOS and Android apps with offline sync. Manage your finances anywhere, anytime.",
      gradient: "from-indigo-500/20 to-blue-500/20"
    },
    {
      icon: <Globe className="h-8 w-8 text-primary" />,
      title: "Multi-Currency Support",
      description: "Track expenses in 150+ currencies with real-time exchange rates and international banking.",
      gradient: "from-teal-500/20 to-cyan-500/20"
    }
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Product Designer",
      company: "Stripe",
      image: "https://images.unsplash.com/photo-1494790108755-2616c6b9a6a4?w=150&h=150&fit=crop&crop=face",
      content: "FinanceTracker completely transformed how I manage my finances. The insights are incredible!",
      rating: 5
    },
    {
      name: "Marcus Williams", 
      role: "Software Engineer",
      company: "Google",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      content: "Finally, a finance app that actually understands developers. The API integration is seamless.",
      rating: 5
    },
    {
      name: "Lisa Rodriguez",
      role: "Financial Advisor", 
      company: "Goldman Sachs",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      content: "I recommend FinanceTracker to all my clients. It's professional-grade financial management.",
      rating: 5
    }
  ];

  const stats = [
    { number: "100K+", label: "Active Users", icon: Users },
    { number: "$500M+", label: "Money Tracked", icon: Wallet },
    { number: "99.9%", label: "Uptime", icon: Zap },
    { number: "4.9★", label: "App Store", icon: Star }
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden transition-colors duration-300">
      {/* Animated background gradient */}
      <motion.div 
        className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 transition-colors duration-500"
        animate={{
          background: [
            "linear-gradient(to bottom right, var(--primary)/0.05, transparent, var(--secondary)/0.05)",
            "linear-gradient(to bottom right, var(--secondary)/0.05, transparent, var(--primary)/0.05)",
          ]
        }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "reverse" }}
      />
      
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-primary/10 rounded-full"
            initial={{ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.3, 0.8, 0.3],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2
            }}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <motion.header 
        className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50 transition-colors duration-300"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <motion.div 
            className="flex items-center space-x-2"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Wallet className="h-8 w-8 text-primary" />
            </motion.div>
            <span className="text-xl">FinanceTracker</span>
          </motion.div>
          
          <div className="flex items-center space-x-4">
            <Button variant="ghost" asChild className="hidden sm:inline-flex">
              <Link to="/auth/login">Sign in</Link>
            </Button>
            <SimpleThemeToggle />
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button onClick={handleGetStarted} className="relative overflow-hidden">
                <motion.span
                  className="flex items-center gap-2"
                  whileHover={{ x: -2 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  Get Started
                  <motion.div
                    whileHover={{ x: 3 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </motion.div>
                </motion.span>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-20">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-8"
          >
            <Badge variant="outline" className="px-4 py-2 text-sm mb-6 border-primary/20 bg-primary/5">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="mr-2"
              >
                <Sparkles className="h-4 w-4" />
              </motion.div>
              Introducing AI-Powered Finance Management
            </Badge>
          </motion.div>

          <motion.h1 
            className="text-5xl md:text-7xl lg:text-8xl mb-8 bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent leading-tight"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          >
            Master Your
            <br />
            <motion.span
              animate={{ 
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] 
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent bg-300%"
            >
              Financial Future
            </motion.span>
          </motion.h1>

          <motion.p 
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            The most advanced finance tracker with AI insights, smart budgeting, and bank-grade security. 
            Turn your financial chaos into clarity.
          </motion.p>

          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="lg" 
                onClick={handleGetStarted} 
                className="text-lg px-8 py-6 relative overflow-hidden group"
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100"
                  transition={{ duration: 0.3 }}
                />
                <span className="relative z-10 flex items-center gap-2">
                  Start Free Trial
                  <Zap className="h-5 w-5" />
                </span>
              </Button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 group">
                <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                Watch Demo
              </Button>
            </motion.div>
          </motion.div>

          {/* Key Features Preview */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.5, ease: "easeOut" }}
            className="relative max-w-4xl mx-auto"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: TrendingUp, title: "Smart Analytics", desc: "AI-powered insights" },
                { icon: Shield, title: "Bank-Grade Security", desc: "Your data is protected" },
                { icon: Target, title: "Smart Budgeting", desc: "Reach your goals faster" }
              ].map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 1.7 + index * 0.2 }}
                  className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/5 to-secondary/5 border border-border/20 hover:border-primary/30 transition-all duration-300"
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="mb-4"
                  >
                    <feature.icon className="h-12 w-12 text-primary mx-auto" />
                  </motion.div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-r from-primary/5 to-secondary/5 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <AnimatedText key={index} delay={index * 0.1}>
                <motion.div 
                  className="text-center"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                    className="mb-4"
                  >
                    <stat.icon className="h-8 w-8 text-primary mx-auto" />
                  </motion.div>
                  <h3 className="text-3xl md:text-4xl mb-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {stat.number}
                  </h3>
                  <p className="text-muted-foreground">{stat.label}</p>
                </motion.div>
              </AnimatedText>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <AnimatedText className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Everything You Need
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Powerful features designed to give you complete control over your financial life, 
              backed by cutting-edge AI and security.
            </p>
          </AnimatedText>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <FloatingCard key={index} delay={index * 0.1}>
                <Card className="h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-background to-secondary/20 backdrop-blur-sm relative overflow-hidden">
                  <motion.div
                    className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />
                  <CardHeader className="text-center relative z-10">
                    <motion.div 
                      className="mx-auto mb-6 p-4 bg-primary/10 rounded-full w-fit relative overflow-hidden"
                      whileHover={{ 
                        rotate: [0, -10, 10, -10, 0],
                        scale: 1.1 
                      }}
                      transition={{ duration: 0.5 }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-full"
                      />
                      {feature.icon}
                    </motion.div>
                    <CardTitle className="text-xl mb-3">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <CardDescription className="text-center text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </FloatingCard>
            ))}
          </div>
        </div>
      </section>

      {/* App Preview Section */}
      <ParallaxSection>
        <section className="py-32 bg-gradient-to-br from-primary/5 to-secondary/5 transition-colors duration-300">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <AnimatedText>
                <div>
                  <Badge variant="outline" className="mb-6 px-3 py-1 border-primary/20 bg-primary/5">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Mobile Experience
                  </Badge>
                  <h3 className="text-3xl md:text-4xl mb-6">
                    Track finances
                    <br />
                    <span className="text-primary">on the go</span>
                  </h3>
                  <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                    Native mobile apps with offline sync, biometric authentication, and instant notifications. 
                    Your financial data is always at your fingertips, secure and up-to-date.
                  </p>
                  <div className="space-y-4">
                    {["Offline transaction sync", "Biometric security", "Real-time notifications", "Cross-platform sync"].map((feature, index) => (
                      <motion.div 
                        key={index}
                        className="flex items-center space-x-3"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        viewport={{ once: true }}
                      >
                        <CheckCircle className="h-5 w-5 text-primary" />
                        <span>{feature}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </AnimatedText>
              
              <motion.div
                initial={{ opacity: 0, x: 100 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="relative"
              >
                <motion.div
                  animate={{ rotate: [0, 1, -1, 0] }}
                  transition={{ duration: 6, repeat: Infinity }}
                  className="rounded-3xl overflow-hidden shadow-2xl"
                >
                  <ImageWithFallback
                    src="https://images.unsplash.com/photo-1681826291722-70bd7e9e6fc3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2JpbGUlMjBiYW5raW5nJTIwYXBwfGVufDF8fHx8MTc1NTI0NjExMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
                    alt="Mobile App Interface"
                    className="w-full h-auto"
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>
      </ParallaxSection>

      {/* Testimonials */}
      <section className="py-32 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <AnimatedText className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl mb-6">
              Loved by <span className="text-primary">thousands</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              See what our users say about their experience
            </p>
          </AnimatedText>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <FloatingCard key={index} delay={index * 0.2}>
                <Card className="h-full border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-background to-secondary/10">
                  <CardContent className="p-6">
                    <div className="flex items-center mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.1 + i * 0.1 }}
                        >
                          <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        </motion.div>
                      ))}
                    </div>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center space-x-3">
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        className="w-10 h-10 rounded-full overflow-hidden"
                      >
                        <ImageWithFallback
                          src={testimonial.image}
                          alt={testimonial.name}
                          className="w-full h-full object-cover"
                        />
                      </motion.div>
                      <div>
                        <p>{testimonial.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {testimonial.role} at {testimonial.company}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </FloatingCard>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-32 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground relative overflow-hidden transition-all duration-300">
        <motion.div
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(circle at 20% 80%, rgba(0,0,0,0.4) 0%, transparent 50%)",
              "radial-gradient(circle at 80% 20%, rgba(0,0,0,0.4) 0%, transparent 50%)",
              "radial-gradient(circle at 40% 40%, rgba(0,0,0,0.4) 0%, transparent 50%)"
            ]
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl mb-6">
              Ready to transform your finances?
            </h2>
            <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
              Join thousands of users who have taken control of their financial future with FinanceTracker.
            </p>
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button 
                size="lg" 
                variant="secondary" 
                onClick={handleGetStarted}
                className="text-lg px-12 py-6 bg-white text-black hover:bg-gray-100"
              >
                Start Your Free Trial
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="ml-2"
                >
                  <ArrowUpRight className="h-5 w-5" />
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-background/95 backdrop-blur-sm py-16 transition-colors duration-300">
        <div className="container mx-auto px-4">
          <AnimatedText>
            <div className="text-center">
              <motion.div 
                className="flex items-center justify-center space-x-2 mb-6"
                whileHover={{ scale: 1.05 }}
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <Wallet className="h-8 w-8 text-primary" />
                </motion.div>
                <span className="text-2xl">FinanceTracker</span>
              </motion.div>
              <p className="text-muted-foreground mb-8">
                Built with ❤️ for your financial success
              </p>
              <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
                <motion.a whileHover={{ scale: 1.05 }} href="#" className="hover:text-primary transition-colors">
                  Privacy Policy
                </motion.a>
                <motion.a whileHover={{ scale: 1.05 }} href="#" className="hover:text-primary transition-colors">
                  Terms of Service
                </motion.a>
                <motion.a whileHover={{ scale: 1.05 }} href="#" className="hover:text-primary transition-colors">
                  Contact Us
                </motion.a>
              </div>
            </div>
          </AnimatedText>
        </div>
      </footer>
    </div>
  );
}