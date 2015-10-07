const admins = [
  { "email": "admin@admin.com" }
];

let setAdmins = () => {
  // for ( let i = 0; i < admins.length; i++ ) {
  //   var admin   = Meteor.users.findOne( { "emails.address": admins[i].email }, { fields: { "_id": 1 } } );
  //       isAdmin = _isUserAnAdmin( admin._id );
  //
  //   if ( !isAdmin ) {
  //     Roles.setUserRoles( admin._id, 'admin' );
  //   }
  // }
};

let _isUserAnAdmin = ( userId ) => {
  return Roles.userIsInRole( userId, 'admin' );
};

Modules.server.setAdmins = setAdmins;
