export interface FloaterBody {
  offset: { x: number; y: number };
  vel: { x: number; y: number };
  parallax: number;
  lagScale: number;
  returnScale: number;
  microAmp: number;
  microFreqX: number;
  microFreqY: number;
  microPhase: number;
}

export interface PhysicsState {
  rawViewVel: { x: number; y: number };
  viewVel: { x: number; y: number };
  prevViewVel: { x: number; y: number };
  stationaryTime: number;
  floaters: FloaterBody[];
}

interface LagModel {
  spring: number;
  damping: number;
  kick: number;
  settleDelay: number;
  returnRamp: number;
  returnSpring: number;
  returnDamping: number;
  velBlend: number;
  accBlend: number;
  accScale: number;
  inputTau: number;
}

const PHYSICS_CONSTANTS = {
  BASE_PARALLAX: 1.0,
  GAZE_COUPLING: 20,
};

export function createPhysicsState(): PhysicsState {
  return {
    rawViewVel: { x: 0, y: 0 },
    viewVel: { x: 0, y: 0 },
    prevViewVel: { x: 0, y: 0 },
    stationaryTime: 0,
    floaters: [],
  };
}

export function makeFloaterBody(rng = Math.random): FloaterBody {
  const depth = rng();
  const parAmount = PHYSICS_CONSTANTS.BASE_PARALLAX;
  const parallax = (0.35 + 1.15 * (1 - depth)) * (0.75 + 0.5 * parAmount);

  return {
    offset: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    parallax,
    lagScale: 0.85 + rng() * 0.35,
    returnScale: 0.82 + rng() * 0.36,
    microAmp: 0.02 + rng() * 0.06,
    microFreqX: 0.5 + rng() * 1.1,
    microFreqY: 0.5 + rng() * 1.1,
    microPhase: rng() * Math.PI * 2,
  };
}

export function resetPhysicsState(state: PhysicsState) {
  state.rawViewVel.x = 0;
  state.rawViewVel.y = 0;
  state.viewVel.x = 0;
  state.viewVel.y = 0;
  state.prevViewVel.x = 0;
  state.prevViewVel.y = 0;
  state.stationaryTime = 0;
  for (const floater of state.floaters) {
    floater.offset.x = 0;
    floater.offset.y = 0;
    floater.vel.x = 0;
    floater.vel.y = 0;
  }
}

function getLagModel(lagPercent: number): LagModel {
  const t = (Number(lagPercent) / 100) * 0.5;
  return {
    spring: 13 - 7 * t,
    damping: 6 - 3.5 * t,
    kick: 24 + 20 * t,
    settleDelay: 0.02 + 0.05 * t,
    returnRamp: 0.18 + 0.16 * t,
    returnSpring: 20 + 16 * t,
    returnDamping: 10 + 8 * t,
    velBlend: 0.35,
    accBlend: 0.65,
    accScale: 0.015,
    inputTau: 0.06,
  };
}

function smoothViewVelocity(state: PhysicsState, dt: number, tau: number) {
  const a = 1 - Math.exp(-dt / Math.max(1e-4, tau));
  state.viewVel.x += a * (state.rawViewVel.x - state.viewVel.x);
  state.viewVel.y += a * (state.rawViewVel.y - state.viewVel.y);
}

function computeViewAcceleration(state: PhysicsState, dt: number) {
  const invDt = 1 / Math.max(1e-4, dt);
  const acc = {
    x: (state.viewVel.x - state.prevViewVel.x) * invDt,
    y: (state.viewVel.y - state.prevViewVel.y) * invDt,
  };
  state.prevViewVel.x = state.viewVel.x;
  state.prevViewVel.y = state.viewVel.y;
  return acc;
}

function computeReturnEase(
  state: PhysicsState,
  dt: number,
  settleThreshold: number,
  settleDelay: number,
  returnRamp: number,
) {
  const inputMag = Math.hypot(state.viewVel.x, state.viewVel.y);
  if (inputMag < settleThreshold) {
    state.stationaryTime += dt;
  } else {
    state.stationaryTime = 0;
  }

  const stationaryOver = Math.max(0, state.stationaryTime - settleDelay);
  const returnBlend = Math.min(1, stationaryOver / Math.max(1e-4, returnRamp));
  const returnEase = returnBlend * returnBlend * (3 - 2 * returnBlend);

  state.viewVel.x *= 1 - returnEase;
  state.viewVel.y *= 1 - returnEase;

  return returnEase;
}

function getClampedInput(v: { x: number; y: number }, maxInput: number) {
  return {
    vx: Math.max(-maxInput, Math.min(maxInput, v.x)),
    vy: Math.max(-maxInput, Math.min(maxInput, v.y)),
  };
}

function blendDriveInput(
  velInput: { vx: number; vy: number },
  accInput: { vx: number; vy: number },
  lag: LagModel,
) {
  return {
    vx: lag.velBlend * velInput.vx + lag.accBlend * (accInput.vx * lag.accScale),
    vy: lag.velBlend * velInput.vy + lag.accBlend * (accInput.vy * lag.accScale),
  };
}

function getMicroMotion(floater: FloaterBody, tSec: number) {
  return {
    microX:
      Math.sin(tSec * floater.microFreqX + floater.microPhase) * floater.microAmp,
    microY:
      Math.cos(tSec * floater.microFreqY + floater.microPhase * 1.7) * floater.microAmp,
  };
}

function computeFloaterAcceleration(
  floater: FloaterBody,
  lag: LagModel,
  input: { vx: number; vy: number },
  returnEase: number,
  micro: { microX: number; microY: number },
) {
  const axInput =
    input.vx *
    floater.parallax *
    PHYSICS_CONSTANTS.GAZE_COUPLING *
    lag.kick *
    floater.lagScale;
  const ayInput =
    input.vy *
    floater.parallax *
    PHYSICS_CONSTANTS.GAZE_COUPLING *
    lag.kick *
    floater.lagScale;

  const axReturn =
    -lag.returnSpring * returnEase * (floater.offset.x - micro.microX) * floater.returnScale -
    lag.returnDamping * returnEase * floater.vel.x * floater.returnScale;
  const ayReturn =
    -lag.returnSpring * returnEase * (floater.offset.y - micro.microY) * floater.returnScale -
    lag.returnDamping * returnEase * floater.vel.y * floater.returnScale;

  const ax =
    axInput -
    lag.spring * (floater.offset.x - micro.microX) -
    lag.damping * floater.vel.x +
    axReturn;
  const ay =
    ayInput -
    lag.spring * (floater.offset.y - micro.microY) -
    lag.damping * floater.vel.y +
    ayReturn;

  return { ax, ay };
}

function integrateFloater(floater: FloaterBody, accel: { ax: number; ay: number }, dt: number) {
  floater.vel.x += accel.ax * dt;
  floater.vel.y += accel.ay * dt;
  floater.offset.x += floater.vel.x * dt;
  floater.offset.y += floater.vel.y * dt;
}

export function stepPhysics(state: PhysicsState, lagPercent: number, dt: number, nowSec: number) {
  const lag = getLagModel(lagPercent);
  smoothViewVelocity(state, dt, lag.inputTau);
  const viewAcc = computeViewAcceleration(state, dt);

  const settleThreshold = 0.6;
  const returnEase = computeReturnEase(
    state,
    dt,
    settleThreshold,
    lag.settleDelay,
    lag.returnRamp,
  );

  const velInput = getClampedInput(state.viewVel, 120);
  const accInput = getClampedInput(viewAcc, 800);
  const input = blendDriveInput(velInput, accInput, lag);

  for (const floater of state.floaters) {
    const micro = getMicroMotion(floater, nowSec);
    const accel = computeFloaterAcceleration(floater, lag, input, returnEase, micro);
    integrateFloater(floater, accel, dt);
  }
}
