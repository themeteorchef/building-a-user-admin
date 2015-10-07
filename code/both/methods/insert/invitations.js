Meteor.methods({
  sendInvitation( invitation ) {
    check( invitation, {
      email: String,
      role: String
    });

    try {
      Modules.server.sendInvitation({
        email: invitation.email,
        token: Random.hexString( 16 ),
        role: invitation.role,
        date: ( new Date() ).toISOString()
      });
    } catch( exception ) {
      return exception;
    }
  }
});
