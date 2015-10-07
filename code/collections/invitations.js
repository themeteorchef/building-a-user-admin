Invitations = new Meteor.Collection( 'invitations' );

Invitations.allow({
  insert: () => false,
  update: () => false,
  remove: () => false
});

Invitations.deny({
  insert: () => true,
  update: () => true,
  remove: () => true
});

let InvitationsSchema = new SimpleSchema({
  email: {
    type: String,
    label: "Email to send invitation to."
  },
  token: {
    type: String,
    label: "Invitation token."
  },
  role: {
    type: String,
    label: "Role to apply to the user."
  },
  date: {
    type: String,
    label: "Invitation Date"
  }
});

Invitations.attachSchema( InvitationsSchema );
