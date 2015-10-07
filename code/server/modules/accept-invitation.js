let accept = ( options ) => {
  var invite = _getInvitation( options.token );
  var user   = _createUser( options );

  _addUserToRole( user, invite.role );
  _deleteInvite( invite._id );

  return user;
};

let _createUser = ( options ) => {
  var userId = Accounts.createUser( { email: options.email, password: options.password } );

  if ( userId ) {
    return userId;
  }
};

let _getInvitation = ( token ) => {
  var invitation = Invitations.findOne( { "token": token } );

  if ( invitation ) {
    return invitation;
  }
};

let _deleteInvite = ( invite ) => {
  Invitations.remove( { "_id": invite } );
};

let _addUserToRole = ( user, role ) => {
  Roles.setUserRoles( user, role );
};

Modules.server.acceptInvitation = accept;
