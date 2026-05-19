export interface OrgMember {
  id: string;
  name: string;
  email: string;
  labels: string[];
  position: string;
  managerId: string;
  contactPhones: string[];
  contactEmails: string[];
}
