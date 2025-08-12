'use client';

import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from '../../../../../firebaseConfig';
import Toast from '../../components/ui/Toast';

interface StudentFormProps {
  roles: { id: string; libelle: string }[];
  niveaux: { id: string; libelle: string }[];
  filieres: { id: string; libelle: string }[];
  partenaires: { id: string; libelle: string }[];
  showSuccessToast: (msg: string) => void;
  showErrorToast: (msg: string) => void;
  fetchData: () => Promise<void>;
}

export default function StudentForm({ 
  roles = [], 
  niveaux = [], 
  filieres = [],
  partenaires = [], 
  showSuccessToast, 
  showErrorToast, 
  fetchData 
}: StudentFormProps) {

  const [studentForm, setStudentForm] = useState({
    email: '',
    login: '',
    nom: '',
    prenom: '',
    password: '',
    role_id: '',
    first_login: '1',
    date_naissance: '',
    lieu_naissance: '',
    nationalite: '',
    sexe: '',
    cni_passeport: '',
    adresse: '',
    telephone: '',
    situation_matrimoniale: '',
    nombre_enfants: 0,
    programme: '',
    niveau_id: '',
    filiere_id: '',
    classe_id: '',
    classe: '',
    annee_academique: '',
    type_inscription: '',
    dernier_etablissement: '',
    
    // Scholarship fields
    boursier: 'non', // 'oui' ou 'non'
    bourse_fournisseur: null as string | null,
    bourse_valeur: 0,
    
    diplome_obtenu: {
      serie: '',
      annee_obtention: '',
      mention: ''
    },
    parents: {
      pere: {
        nom: '',
        profession: '',
        telephone: ''
      },
      mere: {
        nom: '',
        profession: '',
        telephone: ''
      },
      contact_urgence: {
        lien: '',
        adresse: '',
        telephone: ''
      }
    },
    medical: {
      groupe_sanguin: '',
      allergies: '',
      maladies: '',
      handicap: ''
    },
    transport: {
      moyen: '',
      temps_campus: ''
    },
    documents: {
      copie_bac: null as File | null,
      copie_cni: null as File | null,
      releve_notes: null as File | null
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof studentForm.documents) => {
    if (e.target.files && e.target.files[0]) {
      setStudentForm({
        ...studentForm,
        documents: {
          ...studentForm.documents,
          [field]: e.target.files[0]
        }
      });
    }
  };

  const handleBoursierChange = (value: string) => {
    if (value === 'non') {
      setStudentForm({
        ...studentForm,
        boursier: value,
        bourse_fournisseur: null,
        bourse_valeur: 0
      });
    } else {
      setStudentForm({
        ...studentForm,
        boursier: value
      });
    }
  };

  const createOrGetClass = async (niveauId: string, filiereId: string) => {
    const selectedNiveau = niveaux.find(n => n.id === niveauId);
    const selectedFiliere = filieres.find(f => f.id === filiereId);

    if (!selectedNiveau || !selectedFiliere) {
      throw new Error('Niveau ou filière non trouvé');
    }

    const className = `${selectedNiveau.libelle} ${selectedFiliere.libelle}`;
    const classesRef = collection(db, "classes");

    // Vérifier si la classe existe déjà
    const q = query(
      classesRef, 
      where("niveau_id", "==", niveauId),
      where("filiere_id", "==", filiereId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const existingClass = querySnapshot.docs[0];
      return {
        id: existingClass.id,
        libelle: existingClass.data().libelle,
        niveau_id: existingClass.data().niveau_id,
        filiere_id: existingClass.data().filiere_id
      };
    } else {
      // Générer un nouvel ID séquentiel
      const classesSnapshot = await getDocs(classesRef);
      const newId = classesSnapshot.size + 1;

      const newClassRef = await addDoc(classesRef, {
        id: newId,
        libelle: className,
        niveau_id: niveauId,
        filiere_id: filiereId
      });

      return {
        id: newId.toString(),
        libelle: className,
        niveau_id: niveauId,
        filiere_id: filiereId
      };
    }
  };

  const handleNiveauFiliereChange = async (niveauId: string, filiereId: string) => {
    if (niveauId && filiereId) {
      const selectedNiveau = niveaux.find(n => n.id === niveauId);
      const selectedFiliere = filieres.find(f => f.id === filiereId);
      
      if (selectedNiveau && selectedFiliere) {
        const className = `${selectedNiveau.libelle} ${selectedFiliere.libelle}`;
        
        // Vérifier si la classe existe déjà
        const classesRef = collection(db, "classes");
        const q = query(
          classesRef, 
          where("niveau_id", "==", niveauId),
          where("filiere_id", "==", filiereId)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const existingClass = querySnapshot.docs[0];
          setStudentForm({
            ...studentForm,
            niveau_id: niveauId,
            filiere_id: filiereId,
            classe_id: existingClass.data().id.toString(),
            classe: existingClass.data().libelle
          });
        } else {
          setStudentForm({
            ...studentForm,
            niveau_id: niveauId,
            filiere_id: filiereId,
            classe_id: '',
            classe: className
          });
        }
      }
    } else {
      setStudentForm({
        ...studentForm,
        niveau_id: niveauId,
        filiere_id: filiereId,
        classe: ''
      });
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const studentRole = roles.find(r => r.libelle === 'Etudiant');
      if (!studentRole) {
        showErrorToast('Rôle étudiant non trouvé');
        return;
      }

      if (!studentForm.niveau_id || !studentForm.filiere_id) {
        showErrorToast('Veuillez sélectionner un niveau et une filière');
        return;
      }

      // Validation for scholarship
      if (studentForm.boursier === 'oui' && !studentForm.bourse_fournisseur) {
        showErrorToast('Veuillez sélectionner le fournisseur de bourse');
        return;
      }

      // Gérer la classe
      const classe = await createOrGetClass(studentForm.niveau_id, studentForm.filiere_id);

      // Gestion des fichiers
      const fileUrls = {
        copie_bac: studentForm.documents.copie_bac ? await uploadFile(studentForm.documents.copie_bac) : null,
        copie_cni: studentForm.documents.copie_cni ? await uploadFile(studentForm.documents.copie_cni) : null,
        releve_notes: studentForm.documents.releve_notes ? await uploadFile(studentForm.documents.releve_notes) : null
      };

      const usersSnapshot = await getDocs(collection(db, "users"));
      const newUserId = usersSnapshot.size + 1;

      // Prepare scholarship data
      const scholarshipData = {
        boursier: studentForm.boursier,
        bourse_fournisseur: studentForm.boursier === 'oui' ? studentForm.bourse_fournisseur : null,
        bourse_valeur: studentForm.boursier === 'oui' ? studentForm.bourse_valeur : 0
      };

      await addDoc(collection(db, "users"), {
        ...studentForm,
        ...scholarshipData,
        id: newUserId,
        role_id: studentRole.id,
        classe_id: classe.id,
        classe: classe.libelle,
        documents: fileUrls
      });

      showSuccessToast('Étudiant ajouté avec succès!');
      
      // Réinitialiser le formulaire
      setStudentForm({
        email: '',
        login: '',
        nom: '',
        prenom: '',
        password: '',
        role_id: '',
        first_login: '1',
        date_naissance: '',
        lieu_naissance: '',
        nationalite: '',
        sexe: '',
        cni_passeport: '',
        adresse: '',
        telephone: '',
        situation_matrimoniale: '',
        nombre_enfants: 0,
        programme: '',
        niveau_id: '',
        filiere_id: '',
        classe_id: '',
        classe: '',
        annee_academique: '',
        type_inscription: '',
        dernier_etablissement: '',
        boursier: 'non',
        bourse_fournisseur: null,
        bourse_valeur: 0,
        diplome_obtenu: {
          serie: '',
          annee_obtention: '',
          mention: ''
        },
        parents: {
          pere: {
            nom: '',
            profession: '',
            telephone: ''
          },
          mere: {
            nom: '',
            profession: '',
            telephone: ''
          },
          contact_urgence: {
            lien: '',
            adresse: '',
            telephone: ''
          }
        },
        medical: {
          groupe_sanguin: '',
          allergies: '',
          maladies: '',
          handicap: ''
        },
        transport: {
          moyen: '',
          temps_campus: ''
        },
        documents: {
          copie_bac: null,
          copie_cni: null,
          releve_notes: null
        }
      });
      await fetchData();
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'étudiant:', error);
      showErrorToast('Erreur lors de l\'ajout de l\'étudiant');
    }
  };

  // Fonction simulée pour uploader les fichiers (à implémenter selon votre backend)
  const uploadFile = async (file: File): Promise<string> => {
    // Implémentez votre logique d'upload ici
    // Retourne l'URL du fichier uploadé
    return `https://example.com/uploads/${file.name}`;
  };

  return (
    <form onSubmit={handleStudentSubmit}>
      <div className="row g-3">
        {/* Informations personnelles */}
        <div className="col-12">
          <h5 className="fw-bold">Informations personnelles</h5>
          <hr />
        </div>
        <div className="col-md-4">
                    <label className="form-label">Prénom</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.prenom}
            onChange={(e) => setStudentForm({...studentForm, prenom: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.nom}
            onChange={(e) => setStudentForm({...studentForm, nom: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={studentForm.email}
            onChange={(e) => setStudentForm({...studentForm, email: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Login</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.login}
            onChange={(e) => setStudentForm({...studentForm, login: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Mot de passe</label>
          <input
            type="password"
            className="form-control"
            value={studentForm.password}
            onChange={(e) => setStudentForm({...studentForm, password: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Date de naissance</label>
          <input
            type="date"
            className="form-control"
            value={studentForm.date_naissance}
            onChange={(e) => setStudentForm({...studentForm, date_naissance: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Lieu de naissance</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.lieu_naissance}
            onChange={(e) => setStudentForm({...studentForm, lieu_naissance: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nationalité</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.nationalite}
            onChange={(e) => setStudentForm({...studentForm, nationalite: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Sexe</label>
          <select
            className="form-select"
            value={studentForm.sexe}
            onChange={(e) => setStudentForm({...studentForm, sexe: e.target.value})}
            required
          >
            <option value="">Sélectionner</option>
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">CNI/Passeport</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.cni_passeport}
            onChange={(e) => setStudentForm({...studentForm, cni_passeport: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Adresse</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.adresse}
            onChange={(e) => setStudentForm({...studentForm, adresse: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Téléphone</label>
          <input
            type="tel"
            className="form-control"
            value={studentForm.telephone}
            onChange={(e) => setStudentForm({...studentForm, telephone: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Situation matrimoniale</label>
          <select
            className="form-select"
            value={studentForm.situation_matrimoniale}
            onChange={(e) => setStudentForm({...studentForm, situation_matrimoniale: e.target.value})}
          >
            <option value="">Sélectionner</option>
            <option value="Célibataire">Célibataire</option>
            <option value="Marié(e)">Marié(e)</option>
            <option value="Divorcé(e)">Divorcé(e)</option>
            <option value="Veuf(ve)">Veuf(ve)</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Nombre d enfants</label>
          <input
            type="number"
            className="form-control"
            value={studentForm.nombre_enfants}
            onChange={(e) => setStudentForm({...studentForm, nombre_enfants: parseInt(e.target.value)})}
            min="0"
          />
        </div>

        {/* Informations académiques */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Informations académiques</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Niveau</label>
          <select
            className="form-select"
            value={studentForm.niveau_id}
            onChange={async (e) => {
              const niveauId = e.target.value;
              setStudentForm({...studentForm, niveau_id: niveauId});
              await handleNiveauFiliereChange(niveauId, studentForm.filiere_id);
            }}
            required
          >
            <option value="">Sélectionner un niveau</option>
            {niveaux.map((niveau) => (
              <option key={niveau.id} value={niveau.id}>{niveau.libelle}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Filière</label>
          <select
            className="form-select"
            value={studentForm.filiere_id}
            onChange={async (e) => {
              const filiereId = e.target.value;
              setStudentForm({...studentForm, filiere_id: filiereId});
              await handleNiveauFiliereChange(studentForm.niveau_id, filiereId);
            }}
            required
          >
            <option value="">Sélectionner une filière</option>
            {filieres.map((filiere) => (
              <option key={filiere.id} value={filiere.id}>{filiere.libelle}</option>
            ))}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Classe</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.classe}
            readOnly
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Année académique</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.annee_academique}
            onChange={(e) => setStudentForm({...studentForm, annee_academique: e.target.value})}
            required
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Type d inscription</label>
          <select
            className="form-select"
            value={studentForm.type_inscription}
            onChange={(e) => setStudentForm({...studentForm, type_inscription: e.target.value})}
          >
            <option value="">Sélectionner</option>
            <option value="Nouveau">Nouveau</option>
            <option value="Redoublant">Redoublant</option>
            <option value="Transfert">Transfert</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label">Dernier établissement fréquenté</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.dernier_etablissement}
            onChange={(e) => setStudentForm({...studentForm, dernier_etablissement: e.target.value})}
          />
        </div>

        {/* Diplôme obtenu */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Diplôme obtenu</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Série</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.diplome_obtenu.serie}
            onChange={(e) => setStudentForm({
              ...studentForm,
              diplome_obtenu: {
                ...studentForm.diplome_obtenu,
                serie: e.target.value
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Année d obtention</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.diplome_obtenu.annee_obtention}
            onChange={(e) => setStudentForm({
              ...studentForm,
              diplome_obtenu: {
                ...studentForm.diplome_obtenu,
                annee_obtention: e.target.value
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Mention</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.diplome_obtenu.mention}
            onChange={(e) => setStudentForm({
              ...studentForm,
              diplome_obtenu: {
                ...studentForm.diplome_obtenu,
                mention: e.target.value
              }
            })}
          />
        </div>

        {/* Bourse */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Bourse</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Boursier</label>
          <select
            className="form-select"
            value={studentForm.boursier}
            onChange={(e) => handleBoursierChange(e.target.value)}
          >
            <option value="non">Non</option>
            <option value="oui">Oui</option>
          </select>
        </div>
        {studentForm.boursier === 'oui' && (
          <>
            <div className="col-md-4">
              <label className="form-label">Fournisseur de bourse</label>
              <select
                className="form-select"
                value={studentForm.bourse_fournisseur || ''}
                onChange={(e) => setStudentForm({
                  ...studentForm,
                  bourse_fournisseur: e.target.value
                })}
              >
                <option value="">Sélectionner</option>
                {partenaires && partenaires.map((partenaire) => (
                  <option key={partenaire.id} value={partenaire.id}>{partenaire.libelle}</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label">Valeur de la bourse</label>
              <input
                type="number"
                className="form-control"
                value={studentForm.bourse_valeur}
                onChange={(e) => setStudentForm({
                  ...studentForm,
                  bourse_valeur: parseFloat(e.target.value)
                })}
                min="0"
              />
            </div>
          </>
        )}

        {/* Parents */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Parents</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom du père</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.parents.pere.nom}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                pere: {
                  ...studentForm.parents.pere,
                  nom: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Profession du père</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.parents.pere.profession}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                pere: {
                  ...studentForm.parents.pere,
                  profession: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Téléphone du père</label>
          <input
            type="tel"
            className="form-control"
            value={studentForm.parents.pere.telephone}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                pere: {
                  ...studentForm.parents.pere,
                  telephone: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Nom de la mère</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.parents.mere.nom}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                mere: {
                  ...studentForm.parents.mere,
                  nom: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Profession de la mère</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.parents.mere.profession}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                mere: {
                  ...studentForm.parents.mere,
                  profession: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Téléphone de la mère</label>
          <input
            type="tel"
            className="form-control"
            value={studentForm.parents.mere.telephone}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                mere: {
                  ...studentForm.parents.mere,
                  telephone: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Lien avec le contact d urgence</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.parents.contact_urgence.lien}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                contact_urgence: {
                  ...studentForm.parents.contact_urgence,
                  lien: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Adresse du contact d urgence</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.parents.contact_urgence.adresse}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                contact_urgence: {
                  ...studentForm.parents.contact_urgence,
                  adresse: e.target.value
                }
              }
            })}
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Téléphone du contact d urgence</label>
          <input
            type="tel"
            className="form-control"
            value={studentForm.parents.contact_urgence.telephone}
            onChange={(e) => setStudentForm({
              ...studentForm,
              parents: {
                ...studentForm.parents,
                contact_urgence: {
                  ...studentForm.parents.contact_urgence,
                  telephone: e.target.value
                }
              }
            })}
          />
        </div>

        {/* Informations médicales */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Informations médicales</h5>
          <hr />
        </div>
        <div className="col-md-3">
          <label className="form-label">Groupe sanguin</label>
          <select
            className="form-select"
            value={studentForm.medical.groupe_sanguin}
            onChange={(e) => setStudentForm({
              ...studentForm,
              medical: {
                ...studentForm.medical,
                groupe_sanguin: e.target.value
              }
            })}
          >
            <option value="">Sélectionner</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>
        </div>
        <div className="col-md-3">
          <label className="form-label">Allergies</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.medical.allergies}
            onChange={(e) => setStudentForm({
              ...studentForm,
              medical: {
                ...studentForm.medical,
                allergies: e.target.value
              }
            })}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Maladies</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.medical.maladies}
            onChange={(e) => setStudentForm({
              ...studentForm,
              medical: {
                ...studentForm.medical,
                maladies: e.target.value
              }
            })}
          />
        </div>
        <div className="col-md-3">
          <label className="form-label">Handicap</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.medical.handicap}
            onChange={(e) => setStudentForm({
              ...studentForm,
              medical: {
                ...studentForm.medical,
                handicap: e.target.value
              }
            })}
          />
        </div>

        {/* Transport */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Transport</h5>
          <hr />
        </div>
        <div className="col-md-6">
          <label className="form-label">Moyen de transport</label>
          <select
            className="form-select"
            value={studentForm.transport.moyen}
            onChange={(e) => setStudentForm({
              ...studentForm,
              transport: {
                ...studentForm.transport,
                moyen: e.target.value
              }
            })}
          >
            <option value="">Sélectionner</option>
            <option value="Bus scolaire">Bus scolaire</option>
            <option value="Transport public">Transport public</option>
            <option value="Véhicule personnel">Véhicule personnel</option>
            <option value="Marche">Marche</option>
            <option value="Autre">Autre</option>
          </select>
        </div>
        <div className="col-md-6">
          <label className="form-label">Temps pour arriver au campus</label>
          <input
            type="text"
            className="form-control"
            value={studentForm.transport.temps_campus}
            onChange={(e) => setStudentForm({
              ...studentForm,
              transport: {
                ...studentForm.transport,
                temps_campus: e.target.value
              }
            })}
            placeholder="Ex: 30 minutes"
          />
        </div>

        {/* Documents */}
        <div className="col-12 mt-4">
          <h5 className="fw-bold">Documents</h5>
          <hr />
        </div>
        <div className="col-md-4">
          <label className="form-label">Copie du BAC</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, 'copie_bac')}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Copie CNI/Passeport</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, 'copie_cni')}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>
        <div className="col-md-4">
          <label className="form-label">Relevé de notes</label>
          <input
            type="file"
            className="form-control"
            onChange={(e) => handleFileChange(e, 'releve_notes')}
            accept=".pdf,.jpg,.jpeg,.png"
          />
        </div>

        {/* Submit button */}
        <div className="col-12 mt-4">
          <button type="submit" className="btn btn-primary">
            Enregistrer l étudiant
          </button>
        </div>
      </div>
    </form>
  );
}