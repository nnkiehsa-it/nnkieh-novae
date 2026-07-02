<template>
  <section class="startup-screen" role="status" aria-live="polite" aria-label="正在啟動 App">
    <div class="startup-screen__surface">
      <div class="startup-screen__brand" aria-hidden="true">
        <BrandMark custom-class="startup-screen__mark" />
      </div>

      <div class="startup-screen__copy">
        <p class="startup-screen__eyebrow">學生學權提案平台</p>
        <h1 class="startup-screen__title">{{ appTitle }}</h1>
        <p class="startup-screen__tagline">正在準備</p>
      </div>

      <div class="startup-screen__loader" aria-hidden="true">
        <span class="startup-screen__loader-glow"></span>
        <span class="startup-screen__loader-line"></span>
        <span class="startup-screen__loader-trace"></span>
        <span class="startup-screen__loader-node startup-screen__loader-node--start"></span>
        <span class="startup-screen__loader-node startup-screen__loader-node--end"></span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import BrandMark from '@/components/ui/BrandMark.vue';

const appTitle = import.meta.env.VITE_APP_TITLE ?? 'SRP';
</script>

<style scoped>
.startup-screen {
  --startup-accent: 180 126 36;
  --startup-accent-bright: 226 190 110;
  --startup-accent-soft: 246 228 185;
  --startup-wash: 255 252 246;
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  min-height: 100vh;
  min-height: 100dvh;
  place-items: center;
  overflow: hidden;
  padding:
    max(1.5rem, env(safe-area-inset-top))
    max(1.25rem, env(safe-area-inset-right))
    max(1.5rem, env(safe-area-inset-bottom))
    max(1.25rem, env(safe-area-inset-left));
  background:
    radial-gradient(circle at 50% 34%, rgb(var(--startup-accent-soft) / 0.24), transparent 24rem),
    radial-gradient(circle at 50% 78%, rgb(var(--startup-wash) / 0.42), transparent 22rem),
    linear-gradient(180deg, rgb(var(--color-page-background)) 0%, rgb(var(--color-page-background)) 100%);
  color: rgb(var(--color-on-surface));
}

.startup-screen::before {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgb(var(--color-surface) / 0.28), transparent 32%),
    radial-gradient(circle at 50% 44%, rgb(var(--startup-accent) / 0.08), transparent 21rem);
  content: '';
  opacity: 0.82;
  pointer-events: none;
}

.startup-screen__surface {
  position: relative;
  z-index: 1;
  display: flex;
  width: min(100%, 28rem);
  flex-direction: column;
  align-items: center;
  gap: 1.35rem;
  text-align: center;
  animation: startup-enter 620ms var(--motion-ease-enter) both;
}

.startup-screen__brand {
  display: grid;
  height: 6.25rem;
  width: 6.25rem;
  place-items: center;
  border: 1px solid rgb(var(--color-on-surface) / 0.08);
  border-radius: 1.5rem;
  background: rgb(var(--color-surface) / 0.76);
  box-shadow: 0 1.25rem 3rem rgb(var(--color-shadow) / 0.12);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.startup-screen__mark {
  font-size: 4.6rem;
}

.startup-screen__copy {
  display: grid;
  gap: 0.35rem;
}

.startup-screen__eyebrow,
.startup-screen__tagline {
  margin: 0;
  color: rgb(var(--color-outline));
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.5;
}

.startup-screen__eyebrow {
  letter-spacing: 0;
}

.startup-screen__title {
  margin: 0;
  color: rgb(var(--color-on-surface));
  font-size: clamp(2rem, 8vw, 3rem);
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.05;
}

.startup-screen__loader {
  position: relative;
  display: block;
  height: 1.35rem;
  width: min(12rem, 62vw);
  overflow: hidden;
  border-radius: 999px;
  isolation: isolate;
}

.startup-screen__loader-line,
.startup-screen__loader-trace,
.startup-screen__loader-glow {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: 0.2rem;
  border-radius: 999px;
  transform: translateY(-50%);
}

.startup-screen__loader-line {
  background: linear-gradient(
    90deg,
    transparent,
    rgb(var(--color-outline) / 0.22) 18%,
    rgb(var(--startup-accent) / 0.28) 50%,
    rgb(var(--color-outline) / 0.22) 82%,
    transparent
  );
}

.startup-screen__loader-trace {
  width: 42%;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(var(--startup-accent) / 0.34),
    rgb(var(--startup-accent-bright) / 0.92),
    rgb(var(--startup-accent) / 0.72),
    transparent
  );
  box-shadow: 0 0 1rem rgb(var(--startup-accent) / 0.2);
  animation: startup-trace 1450ms cubic-bezier(0.55, 0, 0.2, 1) infinite;
}

.startup-screen__loader-glow {
  inset-inline: 12%;
  height: 0.68rem;
  background: rgb(var(--startup-accent-soft) / 0.34);
  filter: blur(0.55rem);
  opacity: 0.8;
  animation: startup-glow 1800ms ease-in-out infinite;
}

.startup-screen__loader-node {
  position: absolute;
  top: 50%;
  height: 0.46rem;
  width: 0.46rem;
  border: 1px solid rgb(var(--color-surface) / 0.85);
  border-radius: 999px;
  background: rgb(var(--startup-accent-bright));
  box-shadow:
    0 0 0 0.32rem rgb(var(--startup-accent) / 0.1),
    0 0 1rem rgb(var(--startup-accent) / 0.2);
  transform: translateY(-50%);
}

:global(html.dark) .startup-screen {
  --startup-accent: 250 214 140;
  --startup-accent-bright: 255 232 179;
  --startup-accent-soft: 94 70 30;
  --startup-wash: 30 29 25;
}

.startup-screen__loader-node--start {
  left: 0.2rem;
  opacity: 0.52;
}

.startup-screen__loader-node--end {
  right: 0.2rem;
  animation: startup-node 1450ms ease-in-out infinite;
}

@keyframes startup-enter {
  from {
    opacity: 0;
    transform: translateY(0.75rem) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes startup-trace {
  0%,
  100% {
    opacity: 0;
    transform: translate(-58%, -50%) scaleX(0.72);
  }
  16% {
    opacity: 0.92;
  }
  54% {
    opacity: 1;
    transform: translate(82%, -50%) scaleX(1);
  }
  78% {
    opacity: 0;
    transform: translate(138%, -50%) scaleX(0.7);
  }
}

@keyframes startup-glow {
  0%,
  100% {
    opacity: 0.34;
    transform: translateY(-50%) scaleX(0.72);
  }
  50% {
    opacity: 0.82;
    transform: translateY(-50%) scaleX(1);
  }
}

@keyframes startup-node {
  0%,
  100% {
    opacity: 0.46;
    transform: translateY(-50%) scale(0.86);
  }
  52% {
    opacity: 1;
    transform: translateY(-50%) scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .startup-screen__surface,
  .startup-screen__loader-trace,
  .startup-screen__loader-glow,
  .startup-screen__loader-node--end {
    animation: none;
  }
}
</style>
