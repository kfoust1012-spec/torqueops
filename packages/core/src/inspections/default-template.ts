import type { DefaultInspectionTemplate } from "@mobile-mechanic/types";

export const DEFAULT_INSPECTION_TEMPLATE: DefaultInspectionTemplate = {
  version: "v1",
  sections: [
    {
      key: "tires-wheels",
      title: "Tires & Wheels",
      position: 0,
      items: [
        { key: "tire_condition", label: "Tire condition", position: 0, isRequired: true },
        { key: "tire_tread_depth", label: "Tire tread depth", position: 1, isRequired: true },
        { key: "wheel_lug_nuts", label: "Wheel and lug nut condition", position: 2, isRequired: true }
      ]
    },
    {
      key: "brakes",
      title: "Brakes",
      position: 1,
      items: [
        { key: "brake_pads", label: "Brake pad condition", position: 0, isRequired: true },
        { key: "rotors_drums", label: "Rotor and drum condition", position: 1, isRequired: true },
        { key: "brake_fluid", label: "Brake fluid condition", position: 2, isRequired: true }
      ]
    },
    {
      key: "fluids",
      title: "Fluids",
      position: 2,
      items: [
        { key: "engine_oil", label: "Engine oil condition", position: 0, isRequired: true },
        { key: "coolant", label: "Coolant condition", position: 1, isRequired: true },
        { key: "visible_leaks", label: "Visible fluid leaks", position: 2, isRequired: true }
      ]
    },
    {
      key: "battery-charging",
      title: "Battery & Charging",
      position: 3,
      items: [
        { key: "battery_condition", label: "Battery condition", position: 0, isRequired: true },
        { key: "battery_terminals", label: "Battery terminals and corrosion", position: 1, isRequired: true },
        { key: "charging_system", label: "Charging system output", position: 2, isRequired: true }
      ]
    },
    {
      key: "belts-hoses",
      title: "Belts & Hoses",
      position: 4,
      items: [
        { key: "drive_belt", label: "Drive belt condition", position: 0, isRequired: true },
        { key: "coolant_hoses", label: "Coolant hose condition", position: 1, isRequired: true },
        { key: "hose_wear", label: "Visible hose wear or cracking", position: 2, isRequired: true }
      ]
    },
    {
      key: "suspension-steering",
      title: "Suspension & Steering",
      position: 5,
      items: [
        { key: "steering_components", label: "Steering component condition", position: 0, isRequired: true },
        { key: "suspension_components", label: "Suspension component condition", position: 1, isRequired: true },
        { key: "wear_alignment", label: "Wear patterns or alignment concerns", position: 2, isRequired: true }
      ]
    },
    {
      key: "lights-electrical",
      title: "Lights & Electrical",
      position: 6,
      items: [
        { key: "exterior_lights", label: "Exterior lights operation", position: 0, isRequired: true },
        { key: "interior_warnings", label: "Interior warning lights", position: 1, isRequired: true },
        { key: "basic_electrical", label: "Basic electrical operation", position: 2, isRequired: true }
      ]
    },
    {
      key: "engine-performance",
      title: "Engine & Performance",
      position: 7,
      items: [
        { key: "start_idle", label: "Starting and idle quality", position: 0, isRequired: true },
        { key: "abnormal_noises", label: "Abnormal noises or vibration", position: 1, isRequired: true },
        { key: "performance_concerns", label: "Visible performance concerns", position: 2, isRequired: true }
      ]
    }
  ]
};
