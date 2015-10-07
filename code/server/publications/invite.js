Meteor.publish( 'invite', function( token ) {
  check( token, String );
  return Invitations.find( { "token": token } );
});
