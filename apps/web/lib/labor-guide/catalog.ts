type CuratedLaborGuideRule = {
  code: string;
  name: string;
  description: string;
  suggestedHours: number;
  rationale: string;
  signals: string[];
  minimumSignals?: number;
  highConfidenceSignals?: number;
};

export const curatedLaborGuideRules: CuratedLaborGuideRule[] = [
  {
    code: "brake-system-inspection",
    name: "Brake system inspection",
    description: "Inspect pad thickness, rotor condition, hardware, and hydraulic feel before final parts approval.",
    suggestedHours: 1,
    rationale: "Brake complaints are safer to quote after inspection confirms wear pattern and component condition.",
    signals: [
      "brake noise",
      "brakes grinding",
      "brake grinding",
      "brake squeal",
      "brake squeak",
      "soft brake pedal",
      "brake vibration",
      "vibration when braking"
    ],
    highConfidenceSignals: 2
  },
  {
    code: "front-brake-pad-rotor-replacement",
    name: "Front brake pad and rotor replacement",
    description: "Replace front pads and service or replace rotors as inspection confirms.",
    suggestedHours: 2,
    rationale: "Front brake service is a common follow-up when the complaint already points to known front brake wear.",
    signals: [
      "front brake",
      "front brake pads",
      "front brake pad and rotor replacement",
      "front brakes",
      "front rotor replacement",
      "pad and rotor replacement",
      "front rotors",
      "replace front brakes",
      "brake job"
    ],
    minimumSignals: 1
  },
  {
    code: "check-engine-light-diagnosis",
    name: "Check engine light diagnosis",
    description: "Scan modules, confirm active and stored faults, and document next repair steps.",
    suggestedHours: 1,
    rationale: "Fault-code complaints should stay diagnostic-first until root cause is confirmed.",
    signals: ["check engine light", "engine light", "cel", "misfire", "p030"],
    highConfidenceSignals: 2
  },
  {
    code: "starting-charging-system-test",
    name: "Starting and charging system test",
    description: "Load-test the battery and verify starter draw and charging output before replacement decisions.",
    suggestedHours: 0.5,
    rationale: "Battery and charging complaints often overlap, so testing first keeps the estimate manual-first.",
    signals: [
      "dead battery",
      "battery dead",
      "slow crank",
      "jump start",
      "weak battery",
      "alternator issue"
    ]
  },
  {
    code: "battery-replacement",
    name: "Battery replacement",
    description: "Replace the failed battery, service the terminals, and verify charging system baseline after install.",
    suggestedHours: 0.4,
    rationale: "When the failed battery is already confirmed, the estimate should move straight into replacement labor instead of circling back through diagnosis wording.",
    signals: [
      "battery replacement",
      "replace battery",
      "new battery",
      "battery install",
      "battery installation",
      "bad battery"
    ],
    minimumSignals: 1
  },
  {
    code: "no-start-electrical-diagnosis",
    name: "No-start electrical diagnosis",
    description: "Confirm whether the issue is battery, starter, charging, or control-related before quoting parts.",
    suggestedHours: 1,
    rationale: "No-start complaints need a confirmed failure path before committing to part replacement labor.",
    signals: [
      "no start",
      "won t start",
      "won't start",
      "cranks no start",
      "clicking noise starting",
      "starter issue"
    ],
    highConfidenceSignals: 2
  },
  {
    code: "oil-and-filter-service",
    name: "Oil and filter service",
    description: "Perform oil and filter service and reset service indicators if applicable.",
    suggestedHours: 0.5,
    rationale: "Routine maintenance requests can be converted directly into labor time suggestions without changing the estimate flow.",
    signals: ["oil change", "maintenance service", "synthetic oil", "lube service"]
  },
  {
    code: "cooling-system-diagnosis",
    name: "Cooling system diagnosis",
    description: "Pressure-test the cooling system and inspect thermostat, hoses, radiator, and fan operation.",
    suggestedHours: 1,
    rationale: "Cooling complaints need confirmation before a labor estimate is treated as a committed repair plan.",
    signals: ["overheating", "running hot", "coolant leak", "thermostat", "radiator leak"]
  },
  {
    code: "spark-plug-service",
    name: "Spark plug replacement",
    description: "Replace spark plugs and inspect related ignition components during service.",
    suggestedHours: 1.2,
    rationale: "Tune-up style requests can be suggested directly while still leaving pricing and scope editable.",
    signals: ["spark plugs", "tune up", "tune-up"],
    minimumSignals: 1
  },
  {
    code: "serpentine-belt-replacement",
    name: "Serpentine belt replacement",
    description: "Replace the drive belt and inspect belt path components for noise or wear.",
    suggestedHours: 0.8,
    rationale: "Drive-belt complaints often support a labor suggestion, but final pricing should still be reviewed manually.",
    signals: ["serpentine belt", "drive belt", "belt squeal", "belt noise"],
    minimumSignals: 1
  },
  {
    code: "suspension-and-steering-inspection",
    name: "Suspension and steering inspection",
    description: "Inspect steering, suspension, and related wear items before a repair labor quote is finalized.",
    suggestedHours: 1,
    rationale: "Clunks, pulls, and steering vibration are safer to estimate after inspection confirms the worn component.",
    signals: [
      "suspension noise",
      "clunking suspension",
      "steering vibration",
      "wobble",
      "pulling to one side",
      "alignment issue"
    ]
  }
];

export type { CuratedLaborGuideRule };
