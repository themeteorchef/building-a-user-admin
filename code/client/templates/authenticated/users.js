Template.users.onCreated( () => {
  Template.instance().subscribe( 'users' );
});

Template.users.helpers({
  users: function() {
    var users = Meteor.users.find();

    if ( users ) {
      return users;
    }
  },
  hasInvitations: function() {
    var invitations = Invitations.find().count();
    return invitations < 1 ? false : true;
  },
  invitations: function() {
    var invitations = Invitations.find();

    if ( invitations ) {
      return invitations;
    }
  }
});

Template.users.events({
  'change [name="userRole"]': function( event, template ) {
    let role = $( event.target ).find( 'option:selected' ).val();

    Meteor.call( "setRoleOnUser", {
      user: this._id,
      role: role
    }, ( error, response ) => {
      if ( error ) {
        Bert.alert( error.reason, "warning" );
      }
    });
  },
  'click .revoke-invite': function( event, template ) {
    if ( confirm( "Are you sure? This is permanent." ) ) {
      Meteor.call( "revokeInvitation", this._id, function( error, response ) {
        if ( error ) {
          Bert.alert( error.reason, "warning" );
        } else {
          Bert.alert( "Invitation revoked!", "success" );
        }
      });
    }
  }
});
