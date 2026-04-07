import {
  createTinyPngBuffer,
  ensureCompany,
  getBootstrapEnv,
  required,
  waitForStorageReady,
  updateProfileByEmail,
  uploadStorageObject,
  upsertAuthUser,
  upsertMembership
} from "./lib/bootstrap-utils.mjs";

const DEFAULT_PASSWORD = "Password123!";
const PROFILE_PHOTO_BUFFER = createTinyPngBuffer();

const TENANTS = [
  {
    name: "North Loop Mobile Auto",
    slug: "north-loop-mobile-auto",
    accounts: [
      {
        label: "owner",
        email: "owner@northloopauto.com",
        password: DEFAULT_PASSWORD,
        role: "owner",
        profile: {
          full_name: "Morgan Hayes",
          phone: "555-210-1001"
        }
      },
      {
        label: "admin",
        email: "admin@northloopauto.com",
        password: DEFAULT_PASSWORD,
        role: "admin",
        profile: {
          full_name: "Jordan Blake",
          phone: "555-210-1002"
        }
      },
      {
        label: "dispatcher",
        email: "dispatch@northloopauto.com",
        password: DEFAULT_PASSWORD,
        role: "dispatcher",
        profile: {
          full_name: "Taylor Brooks",
          phone: "555-210-1003"
        }
      },
      {
        label: "technician",
        email: "alex.tech@northloopauto.com",
        password: DEFAULT_PASSWORD,
        role: "technician",
        profile: {
          full_name: "Alex Mercer",
          phone: "555-210-1101",
          technician_bio:
            "ASE-certified mobile technician specializing in brakes, drivability, and fleet service.",
          technician_certifications: [
            "ASE Brakes",
            "ASE Suspension & Steering",
            "EPA 609"
          ],
          years_experience: 9,
          meet_your_mechanic_enabled: true,
          profile_photo_bucket: "technician-profile-photos",
          profile_photo_path: "seed/alex-mercer/profile-photo.png"
        }
      },
      {
        label: "technician",
        email: "sam.tech@northloopauto.com",
        password: DEFAULT_PASSWORD,
        role: "technician",
        profile: {
          full_name: "Sam Patel",
          phone: "555-210-1102",
          technician_bio:
            "Mobile diagnostic and maintenance technician focused on electrical and no-start issues.",
          technician_certifications: ["ASE Electrical/Electronic Systems"],
          years_experience: 6,
          meet_your_mechanic_enabled: true,
          profile_photo_bucket: "technician-profile-photos",
          profile_photo_path: "seed/sam-patel/profile-photo.png"
        }
      }
    ]
  },
  {
    name: "Redwood Test Garage",
    slug: "redwood-test-garage",
    accounts: [
      {
        label: "owner",
        email: "owner@redwoodtestgarage.com",
        password: DEFAULT_PASSWORD,
        role: "owner",
        profile: {
          full_name: "Avery Quinn",
          phone: "555-220-1001"
        }
      },
      {
        label: "dispatcher",
        email: "dispatch@redwoodtestgarage.com",
        password: DEFAULT_PASSWORD,
        role: "dispatcher",
        profile: {
          full_name: "Riley Morgan",
          phone: "555-220-1002"
        }
      },
      {
        label: "technician",
        email: "tech@redwoodtestgarage.com",
        password: DEFAULT_PASSWORD,
        role: "technician",
        profile: {
          full_name: "Taylor Reed",
          phone: "555-220-1101",
          technician_bio: null,
          technician_certifications: [],
          years_experience: null,
          meet_your_mechanic_enabled: false,
          profile_photo_bucket: null,
          profile_photo_path: null
        }
      }
    ]
  }
];

async function seedTechnicianProfilePhoto({ supabaseUrl, serviceRoleKey, account }) {
  const bucket = account.profile.profile_photo_bucket;
  const objectPath = account.profile.profile_photo_path;

  if (!bucket || !objectPath) {
    return;
  }

  await uploadStorageObject({
    supabaseUrl,
    serviceRoleKey,
    bucket,
    objectPath,
    body: PROFILE_PHOTO_BUFFER,
    contentType: "image/png"
  });
}

async function main() {
  const env = getBootstrapEnv();
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

  console.log(`Using Supabase: ${supabaseUrl}`);
  console.log("Bootstrapping demo and QA tenants...");
  await waitForStorageReady({ supabaseUrl, serviceRoleKey });

  for (const tenant of TENANTS) {
    const hydratedAccounts = [];

    for (const account of tenant.accounts) {
      const userId = await upsertAuthUser({
        supabaseUrl,
        serviceRoleKey,
        email: account.email,
        password: account.password
      });

      hydratedAccounts.push({
        ...account,
        userId
      });
    }

    const owner = hydratedAccounts.find((account) => account.role === "owner");

    if (!owner) {
      throw new Error(`Tenant ${tenant.slug} is missing an owner account.`);
    }

    const company = await ensureCompany({
      supabaseUrl,
      serviceRoleKey,
      name: tenant.name,
      slug: tenant.slug,
      ownerUserId: owner.userId
    });

    for (const account of hydratedAccounts) {
      await seedTechnicianProfilePhoto({
        supabaseUrl,
        serviceRoleKey,
        account
      });

      await upsertMembership({
        supabaseUrl,
        serviceRoleKey,
        companyId: company.id,
        userId: account.userId,
        role: account.role
      });

      await updateProfileByEmail({
        supabaseUrl,
        serviceRoleKey,
        email: account.email,
        payload: {
          ...account.profile,
          default_company_id: company.id
        }
      });
    }

    console.log("");
    console.log(`Company: ${company.name} (${company.slug})`);

    for (const account of hydratedAccounts) {
      console.log(`${account.role}: ${account.email} / ${account.password}`);
    }
  }

  console.log("");
  console.log("Bootstrap complete.");
  console.log("Web login: http://localhost:3000/login");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
