import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion, useScroll, useTransform } from 'framer-motion';
import HeroBlob from './components/HeroBlob';
import TechOrbit from './components/TechOrbit';
import ContactCube from './components/ContactCube';

function App() {
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Message sent successfully!');
    }, 2000);
  };

  const services = [
    { num: "01", title: "Frontend Architecture", desc: "Building scalable, performant client-side applications using React ecosystem and modern state management." },
    { num: "02", title: "Backend Systems", desc: "Designing robust APIs and microservices with Node.js, ASP.NET Core, and optimized database structures." },
    { num: "03", title: "3D & WebGL Integration", desc: "Crafting immersive browser experiences using Three.js, React Three Fiber, and custom shaders." }
  ];

  const projects = [
    { title: "Defi Exchange Platform", role: "Lead Frontend Engineer", tech: "React, Web3.js, Tailwind" },
    { title: "Enterprise Resource Planner", role: "Full-Stack Developer", tech: "ASP.NET Core, MSSQL, React" },
    { title: "Interactive Brand Site", role: "Creative Technologist", tech: "Three.js, GSAP, Node.js" }
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans overflow-x-hidden selection:bg-[#29e0e0] selection:text-black">
      {/* Navigation */}
      <nav className="fixed w-full z-50 px-8 py-6 flex justify-between items-center mix-blend-difference">
        <div className="text-2xl font-bold tracking-tighter" style={{ fontFamily: "'Space Mono', monospace" }}>
          B<span className="text-[#29e0e0]">.</span>
        </div>
        <div className="flex gap-8 text-sm uppercase tracking-widest">
          <a href="#services" className="hover:text-[#29e0e0] transition-colors">Services</a>
          <a href="#work" className="hover:text-[#29e0e0] transition-colors">Work</a>
          <a href="#contact" className="hover:text-[#29e0e0] transition-colors">Contact</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 cursor-pointer" onClick={() => setPaletteIndex(p => p + 1)}>
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <HeroBlob paletteIndex={paletteIndex} />
            <OrbitControls enableZoom={false} enablePan={false} />
          </Canvas>
        </div>

        <div className="relative z-10 pointer-events-none text-center px-4 w-full max-w-5xl">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="text-[clamp(3rem,8vw,8rem)] font-bold mb-6 tracking-tighter leading-none"
            style={{ fontFamily: "'Space Mono', monospace" }}
          >
            Balaji S.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="text-xl md:text-3xl text-gray-400 mb-10 max-w-2xl mx-auto font-light"
          >
            Full-Stack Developer crafting digital experiences. <span className="text-[#29e0e0] opacity-80 text-sm hidden md:inline-block">Click background for magic.</span>
          </motion.p>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500 text-xs uppercase tracking-widest"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          <span>Scroll</span>
          <div className="w-px h-16 bg-gradient-to-b from-gray-500 to-transparent"></div>
        </motion.div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-32 px-8 max-w-7xl mx-auto">
        <div className="mb-20">
          <h2 className="text-sm uppercase tracking-widest text-[#29e0e0] mb-4">What I Do</h2>
          <h3 className="text-4xl md:text-6xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>Core Competencies</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              className="p-8 border border-gray-800 rounded-2xl hover:border-[#29e0e0] transition-colors group bg-[#111113]"
            >
              <div className="text-4xl font-mono text-gray-700 group-hover:text-[#29e0e0] transition-colors mb-6">{service.num}</div>
              <h4 className="text-xl font-bold mb-4">{service.title}</h4>
              <p className="text-gray-400 leading-relaxed">{service.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Skills / Tech Orbit Section */}
      <section className="py-32 px-8 bg-black">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div>
            <motion.h2
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-4xl md:text-6xl font-bold mb-8"
              style={{ fontFamily: "'Space Mono', monospace" }}
            >
              Tech Ecosystem
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-gray-400 text-lg mb-8"
            >
              A robust stack built for performance and scalability. I specialize in modern web technologies to bring complex ideas to life in the browser.
            </motion.p>
            <div className="flex flex-wrap gap-4">
               {["React", "Node.js", "Three.js", "Tailwind", "PostgreSQL", "Docker", "AWS"].map((tech, i) => (
                  <span key={tech} className="px-4 py-2 border border-gray-800 rounded-full text-sm text-gray-300">
                    {tech}
                  </span>
               ))}
            </div>
          </div>
          <div className="h-[500px] bg-[#0a0a0c] rounded-3xl border border-gray-800 relative">
             <Canvas camera={{ position: [0, 1.8, 3.8], fov: 45 }}>
                <ambientLight intensity={0.85} />
                <TechOrbit />
                <OrbitControls enableZoom={false} enablePan={false} />
             </Canvas>
          </div>
        </div>
      </section>

      {/* Selected Work (Horizontal Accordion approximation) */}
      <section id="work" className="py-32 px-8 max-w-7xl mx-auto">
        <div className="mb-20">
          <h2 className="text-sm uppercase tracking-widest text-[#ff2fd0] mb-4">Portfolio</h2>
          <h3 className="text-4xl md:text-6xl font-bold" style={{ fontFamily: "'Space Mono', monospace" }}>Selected Works</h3>
        </div>

        <div className="flex flex-col gap-6">
          {projects.map((project, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className="group border-b border-gray-800 pb-8 flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-[#ff2fd0] transition-colors cursor-pointer"
            >
              <div>
                <h4 className="text-3xl font-bold group-hover:text-[#ff2fd0] transition-colors">{project.title}</h4>
                <p className="text-gray-500 mt-2">{project.role}</p>
              </div>
              <div className="text-sm font-mono text-gray-600 bg-gray-900 px-4 py-2 rounded-full self-start md:self-auto">
                {project.tech}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Stats / Trust Section */}
      <section className="py-20 border-y border-gray-900 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 md:grid-cols-4 gap-12 text-center divide-x divide-gray-900">
          <div>
            <div className="text-5xl font-bold mb-2 text-[#29e0e0]">5+</div>
            <div className="text-sm text-gray-500 uppercase tracking-widest">Years Exp</div>
          </div>
          <div>
            <div className="text-5xl font-bold mb-2 text-[#29e0e0]">40+</div>
            <div className="text-sm text-gray-500 uppercase tracking-widest">Projects</div>
          </div>
          <div>
            <div className="text-5xl font-bold mb-2 text-[#29e0e0]">100%</div>
            <div className="text-sm text-gray-500 uppercase tracking-widest">Delivery</div>
          </div>
          <div>
            <div className="text-5xl font-bold mb-2 text-[#29e0e0]">24/7</div>
            <div className="text-sm text-gray-500 uppercase tracking-widest">Support</div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-32 px-8 bg-black/50">
         <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-16 items-center">
            <div className="flex-1 w-full">
              <h2 className="text-sm uppercase tracking-widest text-[#7a3cff] mb-4">Inquiries</h2>
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-4xl md:text-6xl font-bold mb-12"
                style={{ fontFamily: "'Space Mono', monospace" }}
              >
                Let's Connect
              </motion.h2>
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="relative group">
                  <input
                    type="text"
                    placeholder=" "
                    id="name"
                    className="w-full bg-transparent border-b border-gray-700 py-4 focus:outline-none focus:border-[#7a3cff] transition-colors peer"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    required
                  />
                  <label htmlFor="name" className="absolute left-0 top-4 text-gray-500 transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-[#7a3cff] peer-valid:-top-4 peer-valid:text-xs">Name</label>
                </div>
                <div className="relative group">
                  <input
                    type="email"
                    placeholder=" "
                    id="email"
                    className="w-full bg-transparent border-b border-gray-700 py-4 focus:outline-none focus:border-[#7a3cff] transition-colors peer"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    required
                  />
                  <label htmlFor="email" className="absolute left-0 top-4 text-gray-500 transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-[#7a3cff] peer-valid:-top-4 peer-valid:text-xs">Email</label>
                </div>
                <div className="relative group">
                  <textarea
                    placeholder=" "
                    id="msg"
                    rows="4"
                    className="w-full bg-transparent border-b border-gray-700 py-4 focus:outline-none focus:border-[#7a3cff] transition-colors resize-none peer"
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    required
                  ></textarea>
                   <label htmlFor="msg" className="absolute left-0 top-4 text-gray-500 transition-all peer-focus:-top-4 peer-focus:text-xs peer-focus:text-[#7a3cff] peer-valid:-top-4 peer-valid:text-xs">Message</label>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-10 py-4 bg-[#7a3cff] text-white font-bold tracking-widest uppercase hover:bg-white hover:text-black transition-colors disabled:opacity-50 rounded-full"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
            <div className="flex-1 h-[500px] w-full relative hidden md:block">
               <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }}>
                  <ambientLight intensity={0.9} />
                  <ContactCube isFocused={isFocused} isSubmitting={isSubmitting} />
                  <OrbitControls enableZoom={false} enablePan={false} />
               </Canvas>
            </div>
         </div>
      </section>

      {/* Giant Footer Wordmark */}
      <footer className="pt-32 pb-8 overflow-hidden bg-black flex flex-col items-center">
        <div className="w-full overflow-hidden whitespace-nowrap flex justify-center opacity-10 select-none pointer-events-none mb-20">
          <h2 className="text-[15vw] font-bold tracking-tighter" style={{ fontFamily: "'Space Mono', monospace" }}>
            BALAJI.DEV
          </h2>
        </div>
        <div className="text-center text-gray-600 text-sm flex gap-6">
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">GitHub</a>
          <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
        </div>
        <div className="mt-8 text-xs text-gray-800">
          © {new Date().getFullYear()} Balaji S. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default App;
