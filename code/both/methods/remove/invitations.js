Meteor.methods({
  revokeInvitation( inviteId ) {
    check( inviteId, String );

    try {
      Invitations.remove( inviteId );
    } catch( exception ) {
      return exception;
    }
  }
});
