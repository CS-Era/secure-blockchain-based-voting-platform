import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const students = [
      {
        email: "admin@example.it",
        password: "admin123456",
        fullName: "Admin User",
        isAdmin: true,
      },
      {
        email: "mario.rossi@example.it",
        password: "password123456",
        fullName: "Mario Rossi",
        isAdmin: false,
      },
      {
        email: "giulia.verdi@example.it",
        password: "password123456",
        fullName: "Giulia Verdi",
        isAdmin: false,
      },
      {
        email: "luca.bianchi@example.it",
        password: "password123456",
        fullName: "Luca Bianchi",
        isAdmin: false,
      },
      {
        email: "anna.neri@example.it",
        password: "password123456",
        fullName: "Anna Neri",
        isAdmin: false,
      },
      {
        email: "paolo.rosa@example.it",
        password: "password123456",
        fullName: "Paolo Rosa",
        isAdmin: false,
      },
    ];

    const createdStudents = [];

    for (const student of students) {
      const { data, error: signUpError } = await supabase.auth.admin.createUser({
        email: student.email,
        password: student.password,
        email_confirm: true,
      });

      if (signUpError) {
        console.error(`Error creating user ${student.email}:`, signUpError);
        continue;
      }

      if (data.user) {
        const { error: profileError } = await supabase
          .from("students")
          .insert([
            {
              id: data.user.id,
              email: student.email,
              full_name: student.fullName,
              is_admin: student.isAdmin,
            },
          ]);

        if (profileError) {
          console.error(`Error creating profile for ${student.email}:`, profileError);
        } else {
          createdStudents.push({
            id: data.user.id,
            email: student.email,
            fullName: student.fullName,
          });
        }
      }
    }

    const now = new Date();
    const elections = [
      {
        title: "Presidente Consiglio Studentesco",
        description: "Elezioni per il nuovo presidente del consiglio studentesco. Vota per il candidato che ritieni più idoneo a rappresentare gli studenti.",
        start_date: new Date(now.getTime() - 60 * 60 * 1000),
        end_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        status: "open",
      },
      {
        title: "Rappresentante Classe 5A",
        description: "Elezioni del rappresentante di classe per la classe 5A. Il rappresentante sarà responsabile di comunicare le esigenze della classe ai docenti.",
        start_date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        end_date: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000),
        status: "upcoming",
      },
      {
        title: "Giunta Esecutiva 2024",
        description: "Elezioni completate. I risultati mostrano i membri della giunta esecutiva per l'anno scolastico 2024.",
        start_date: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        status: "closed",
      },
    ];

    const { data: electionsData, error: electionsError } = await supabase
      .from("elections")
      .insert(elections)
      .select();

    if (electionsError) {
      throw electionsError;
    }

    const candidatesData = [
      {
        election_id: electionsData[0].id,
        name: "Marco Conti",
        description: "Studente di quinto anno. Promette di migliorare la qualità della mensa e organizzare più eventi sociali.",
        photo_url: "",
      },
      {
        election_id: electionsData[0].id,
        name: "Elena Moretti",
        description: "Studentessa di quinto anno. Vuole dare più voce agli studenti nelle decisioni della scuola.",
        photo_url: "",
      },
      {
        election_id: electionsData[0].id,
        name: "Federico Gallo",
        description: "Studente di quarto anno. Intende organizzare gite scolastiche e attività sportive.",
        photo_url: "",
      },
      {
        election_id: electionsData[1].id,
        name: "Sofia Rizzo",
        description: "Rappresentante attenta ai bisogni della classe. Propone un ambiente di studio collaborativo.",
        photo_url: "",
      },
      {
        election_id: electionsData[1].id,
        name: "Andrea Colombo",
        description: "Rappresentante dinamico con esperienza nel tutoraggio tra compagni.",
        photo_url: "",
      },
      {
        election_id: electionsData[2].id,
        name: "Valentina Serra",
        description: "Membro della giunta per questioni culturali e ricreative.",
        photo_url: "",
      },
      {
        election_id: electionsData[2].id,
        name: "Davide Ferrari",
        description: "Membro della giunta per questioni sportive e comunicazione.",
        photo_url: "",
      },
      {
        election_id: electionsData[2].id,
        name: "Francesca Bruno",
        description: "Membro della giunta per questioni didattiche e relazioni con docenti.",
        photo_url: "",
      },
    ];

    const { error: candidatesError } = await supabase
      .from("candidates")
      .insert(candidatesData);

    if (candidatesError) {
      throw candidatesError;
    }

    const eligibleStudents = [];
    if (createdStudents.length > 1) {
      const studentsExceptAdmin = createdStudents.slice(1);
      for (const election of electionsData) {
        for (const student of studentsExceptAdmin) {
          eligibleStudents.push({
            election_id: election.id,
            student_id: student.id,
          });
        }
      }
    }

    if (eligibleStudents.length > 0) {
      const { error: eligibleError } = await supabase
        .from("election_eligible_students")
        .insert(eligibleStudents);

      if (eligibleError) {
        console.error("Error creating eligible students:", eligibleError);
      }
    }

    const { data: candidatesWithIds, error: candidatesFetchError } = await supabase
      .from("candidates")
      .select("*");

    if (candidatesFetchError) {
      throw candidatesFetchError;
    }

    const votes = [
      {
        election_id: electionsData[2].id,
        student_id: createdStudents[1]?.id,
        candidate_id: candidatesWithIds.find((c: any) => c.name === "Valentina Serra")?.id,
      },
      {
        election_id: electionsData[2].id,
        student_id: createdStudents[2]?.id,
        candidate_id: candidatesWithIds.find((c: any) => c.name === "Davide Ferrari")?.id,
      },
      {
        election_id: electionsData[2].id,
        student_id: createdStudents[3]?.id,
        candidate_id: candidatesWithIds.find((c: any) => c.name === "Valentina Serra")?.id,
      },
      {
        election_id: electionsData[2].id,
        student_id: createdStudents[4]?.id,
        candidate_id: candidatesWithIds.find((c: any) => c.name === "Francesca Bruno")?.id,
      },
    ].filter((v: any) => v.student_id && v.candidate_id);

    if (votes.length > 0) {
      const { error: votesError } = await supabase
        .from("votes")
        .insert(votes);

      if (votesError) {
        console.error("Error creating votes:", votesError);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Sample data created successfully",
        students: createdStudents,
        electionsCount: electionsData.length,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});