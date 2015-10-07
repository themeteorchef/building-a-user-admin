### Getting started
Before we dive into the code, we'll need to add the following packages to our project so we can make quick use of them later.

<p class="block-header">Terminal</p>

```bash
meteor add alanning:roles
```

We'll rely on the [alanning:roles](https://atmospherejs.com/alanning/roles) package to help us define different roles (types) for our users. This will allow us to control which users have access to certain types of content in our application.

<p class="block-header">Terminal</p>

```bash
meteor add random
```
To make our invitations unique and difficult to "spoof," we'll rely on the [random](https://atmospherejs.com/meteor/random) package to create a random token that we can send to invitees to verify their identity.

<p class="block-header">Terminal</p>

```bash
meteor add email
```

In order to get our invitations sent, we'll rely on the [email](https://atmospherejs.com/meteor/email) package.

<p class="block-header">Terminal</p>

```bash
meteor add momentjs:moment
```
When we display invitations in the user dashboard, we'll use [momentjs:moment](https://atmospherejs.com/momentjs/moment) to help us make the date our invitation was sent a little more human readable.

<div class="note">
  <h3>Additional Packages <i class="fa fa-warning"></i></h3>
  <p>This recipe relies on several other packages that come as part of <a href="http://themeteorchef.com/base">Base</a>, the boilerplate kit used here on The Meteor Chef. The packages listed above are merely recipe-specific additions to the packages that are included by default in the kit. Make sure to reference the <a href="http://themeteorchef.com/base/packages-included">Packages Included list</a> for Base to ensure you have fulfilled all of the dependencies.</p>
</div>

### What are we building?
Our goal for this recipe is to build an admin dashboard for managing different types of users. This feature is handy when we're building applications where a lot of people will need different levels of access. To automate the process of getting new users signed up, we're going to build an invitation workflow that allows us to invite new users via email, while letting them set their own password via a "secret" link. Here's what we're after:

<figure>
  <img src="https://tmc-post-content.s3.amazonaws.com/Screen-Shot-2015-10-06-21-17-40.png" alt="Our admin interface.">
  <figcaption>Our admin interface.</figcaption>
</figure>

Neat! It's simple, but surprisingly powerful. To get things underway, we're going to do a bit of prep work and get our `Invitations` collection set up in the database. This is where we'll temporarily store invitations for new users. Ready? Let's get to it!

### Setting up our `Invitations` collection
When we invite new users, we're going to need a place to store their invitation. An invitation is going to include all of the information we need to get a new user set up. The reason we want to store this information in a collection for later is that all we want our new user to worry about is typing in a password. 

Behind the scenes, we'll use the document we create in the `Invitations` collection when we invite the user to pull up the information related to a top secret token that they'll receive via email. Sounds cool, right? Before we get too far ahead of ourselves, let's get the collection defined.

<p class="block-header">/collections/invitations</p>

```javascript
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
```

Woah! Lots of stuff, but this is pretty straightforward. First, we start by creating a new collection and passing it to a global variable `Invitations` that we can access throughout our application. Easy peasy.

Next, we make sure to lock down database collections on the client. Here, we set all of our `allow` rules for the `Invitations` collection to `false` meaning "don't allow this," and all of our `deny` rules for the collection to `true` meaning deny this. What does this accomplish? While allow and deny rules are neat, they leave room for unintended security holes in our application.

To save face, we can "lock down" all of our rules when we define our collection to prevent any client-side database operations from taking place. This means that when we interact with the database, we're required to do it from the server (a trusted environment) via methods.

Last up, we define a schema for our collection [using the aldeed:collection2 package](http://themeteorchef.com/snippets/using-the-collection2-package/). Here, we specify the exact structure of the data we plan to insert into our collection along with the _types_ (e.g. `String`) those pieces of data will use. We do this because it helps us to block unwanted data from being added to the database.

For example, if we attempt to call `Invitations.insert( { taco: "vegetarian" } );`, the insert would fail because `taco` is not a field defined in our schema. Conversely, if we were to call `Invitations.insert( { email: 123456 } );` instead, our insert would _also_ fail because the `email` field is expecting a `String` value, not a `Number` value. Making sense?

At the bottom of our file, we use the `attachSchema` method we get from the `collection2` package to assign the schema we defined above to our collection. Sweet! With this in place, our collection is all set up. We're going to put this on the shelf for now, though, and focus on setting up our routes. Seriously? Yes. Don't worry, this is going to be...interesting. Prepare to be amused!

### Setting up our routes
For this recipe, we're relying on the latest version of [Base](http://themeteorchef.com/base), the starter kit used for recipes on The Meteor Chef. Before `v3.0.0` of the kit, we relied on [Iron Router](https://github.com/iron-meteor/iron-router) for defining our routes. Now—keeping in stride with the Meteor community—Base relies on [Flow Router](http://themeteorchef.com/snippets/client-side-routing-with-flow-router). 

Flow Router is a bit different from Iron Router in that it takes a more minimalist approach to routing. This means that things like rendering templates and defining `{{pathFor}}` helpers are up to us. Don't let that spook ya. The bulk of the work has already been done as a part of Base, but we'll step through setting up routes here and talking about how they work. 

First, we're going to split our routes into two groups: `public` and `authenticated`. Our `public` routes will be those accessible to anyone who visits our application. Our `authenticated` routes, on the other hand, will only be accessible to users that are logged in. Going _even further_, we'll also set up a bit of authentication in the route using the `roles` package we installed earlier to control which logged in users can access which `authenticated` routes. Helmet on? Seatbelt fastened? Vroom.

#### Public routes
For our recipe, we only need to add one public route ([several others come stock with Base](http://themeteorchef.com/base/routing/)).

<p class="block-header">/both/routes/public.js</p>

```javascript
const publicRoutes = FlowRouter.group({
  name: 'public',
  triggersEnter: [ publicRedirect ]
});

publicRoutes.route( '/invite/:token', {
  name: 'invite',
  action() {
    BlazeLayout.render( 'default', { yield: 'invite' } );
  }
});

[...]
```

Here, we see two things happening. First, we set up a group using Flow Router's [groups](https://github.com/kadirahq/flow-router#group-routes) feature which allows us to—like the name implies—group our routes together. Here, we're separating our `public` routes (the one's we're allowing anyone to access) off by creating a new group and assingning it to the variable `publicRoutes`. Inside, we define two properties: `name` and `triggersEnter`. The first is pretty obvious; the name (or label) for our group. The second one, though, `triggersEnter` is a bit odd. What's that? This property allows us to define an array of functions to be called before all of the routes in our `public` group.

For our purposes, we have just one trigger defined. Hold that in the back of your mind, though. Let's get our public route for this recipe defined and come back this in a bit. Pay attention to the syntax here. We start by calling `publicRoutes.route()` to assign our new route to the `publicRoutes` group. If this were a standalone route, we'd call `FlowRouter.route()`. 

As the first argument, we pass the path for our URL relative to our applications' domain (e.g. `http://localhost:3000/invite/:token`). Inside of our path, we define a parameter `:token` that will allow us to pass a dynamic value along with this URL. As we'll see in a bit, this will be used to pass the invitation token we dynamically generate and send to new users.

As the second argument, we pass an object with two properties: `name` and `action()`. Again, the first argument here should be pretty clear; this is the name we can use to reference our route elsewhere in the applicaiton. The `action()` part is what really separates Flow Router from Iron Router. Here, instead of just passing the name of the template we want to render (like we would with Iron Router's `template` paramater), here, we make a call to `BlazeLayout.render()`. What's that? 

As part of the design philosophy behind Flow Router, the intent was to separate anything that didn't have to immediately deal with routing from the router. Here, `BlazeLayout.render()` compensates for the separation of rendering our Blaze templates from the router. This method is given to us by a separate package included with Base called `kadira:blaze-layout`. It's job is simply to render Blaze templates into the location we specify. It takes two arguments: a `layout` template in the first slot and an object containing the names of "zones" where we'll render the specified template. In this case, we're telling Flow Router to use the `default` layout template and to render our `invite` template to the `yield` zone. Note that we've defined `yield` as the name of the zone. Real quick, let's hop over to our `default` template to see how this works.

<p class="block-header">/client/templates/layouts/default.html</p>

```markup
<template name="default">
  [...]
  <div class="container">
    {{> Template.dynamic template=yield}}
  </div>
</template>
```
To handle our rendering, Flow Router relies on Meteor's [dynamic templates](http://themeteorchef.com/snippets/using-dynamic-templates) feature. Notice that here, we simply specify a `template` property and set it equal to `yield`. What this translates to is whatever template we assign to the `yield` zone in our route's `action()` method will be rendered in place of this `{{> Template.dynamic}}` include. Seeing the flow (no pun intended)? With this in place, whenever we visit `http://localhost:3000/invite/:token`, we'll see our `invite` template rendered. Cool! Next, let's take a look at our `authenticated` routes.

#### Authenticated routes
For our `authenticated` routes, we're going to follow a similar pattern to our `public` routes. Let's take a look.

<p class="block-header">/both/routes/authenticated.js</p>

```javascript
const authenticatedRoutes = FlowRouter.group({
  name: 'authenticated',
  triggersEnter: [ authenticatedRedirect ]
});

authenticatedRoutes.route( '/users', {
  name: 'users',
  triggersEnter: [ blockUnauthorizedAdmin ],
  action() {
    BlazeLayout.render( 'default', { yield: 'users' } );
  }
});

authenticatedRoutes.route( '/managers', {
  name: 'managers',
  triggersEnter: [ blockUnauthorizedManager ],
  action() {
    BlazeLayout.render( 'default', { yield: 'managers' } );
  }
});

authenticatedRoutes.route( '/employees', {
  name: 'employees',
  action() {
    BlazeLayout.render( 'default', { yield: 'employees' } );
  }
});
```

The big three! Again, we're following a similar pattern here. First, we set up a group for our `authenticated` routes and assign it to a variable `authenticatedRoutes`. Got it. Assigned to that group are three routes, each corresponding to roles that we'll define shortly: `/users`, `/managers`, and `/employees`. The last two are pretty clear—these will map to a role called `manager` and `employee` respetively—but what about `/users`? This will be assigned to a role called `admin`. Here, `/users` simply denotes that our `admin` users will see the user admin panel as their default screen. Cool?

Notice that aside from our `action()` method's, on our `users` and `managers` routes we define a second trigger (in addition to the one applied globally like on our `public` routes). On `users` we have `blockUnauthorizedAdmin` and on `managers` we have `blockUnauthorizedManager`. Again, these are a bit sticky so we'll set these up later when we visit the `triggersEnter` property on our `publicRoutes` group. Trust me. It will be a lot easier to take all of that in at once. It's a bit wonky!

Okay, with these in place, we're ready to start working with our users and get our first taste of using the `roles` package. To get started there, we're going to handle adding some administrative and test users to our app so that we can get around without the need for a sign up page (or adding users in the terminal).

### Adding administrators and test users
Most of our work here is already done for us as a part of [Base](http://themeteorchef.com/base). Aren't I nice? Truthfully, we only need to make two small edits to what's included. Let's take a look.

<p class="block-header">/server/modules/generate-accounts.js</p>

```javascript
let administrators = [
  {
    name: { first: 'Admin', last: 'McAdmin' },
    email: 'admin@admin.com',
    password: 'password'
  }
];

[...]

let _createUsers = ( users ) => {
  for ( let i = 0; i < users.length; i++ ) {
    let user       = users[ i ],
        userExists = _checkIfUserExists( user.email );

    if ( !userExists ) {
      let userId  = _createUser( user ),
          isAdmin = _checkIfAdmin( user.email );

      if ( isAdmin ) {
        Roles.setUserRoles( userId, 'admin' );
      } else {
        Roles.setUserRoles( userId, 'employee' );
      }
    }
  }
};

[...]

let _checkIfAdmin = ( email ) => {
  return _.find( administrators, ( admin ) => {
    return admin.email === email;
  });
};

[...]

Modules.server.generateAccounts = generateAccounts;
```

Woah smokies. Yes, this file has a lot going on. We're going to glaze over the bulk of it as it's something that's included in Base but the gist is this: when called from our server's `startup.js` file, if no users exist in the database, create each of the accounts listed in the `administrators` array at the top of the file as well as the number of "fake" or test accounts we specify in the `generateAccounts` method (not displayed here). Woof.

It's not as scary as it sounds. It _is_ however a pain in the butt to do this every time we write an application, so this module is offered up as a way to automate this for you. Sweet! The part we really care about in this file happens in the `_createUsers` function. Here, we loop through all of the users that get passed to our `_createUsers` function—we call this twice, once for admins and once for test users—and create their accounts in the database. For our recipe, the modification we've made is in the `if ( isAdmin ) {}` block toward the bottom. 

Here, we make a check using another function `_checkIfAdmin` that looks in the `adminstrators` array for the email we pass (the user being looped over) to see if it exists. If this value returns `true`, we rely on the `Roles.setUserRoles()` method we get from the `roles` package to set the `admin` role on the user, and if the value returns `false`, we set the `employee` role. Keep in mind this is a simplification and your own application might require something a bit more complex. Fear not, next we'll build an interface that will make it easy to change these roles.

<div class="note">
  <h3>What's with this pattern? <i class="fa fa-warning"></i></h3>
  <p>You may be wondering why our code is split up into little functions like this. Here, we're relying on the <a href="http://themeteorchef.com/snippets/using-the-module-pattern-with-meteor">module pattern</a> to simplify our code and make it a bit easier to read. Doing this, it makes it much easier to both write and read our code as a series of "steps" instead of one big ball of code. You don't have to do this, but it's a handy tool to master if you find your code getting a bit squirrely.</p>
</div>

With this in place, let's start to focus on our templates. There's just one that's complicated, the others will just act as placeholders.

### Setting up our templates
We have four templates we need to set up: `users`, `managers`, `employees`, and `sendInvitationModal`. We'll do these in order of easiest to most complicated. Once these are in place, we'll have everything we need for logged in users. From there, we'll be able to add a bit of authentication using roles to start routing users to the correct templates based on their roles.

#### The easy templates
To showcase our authentication working later, we're going to need to set up two templates now for users that will be assigned to the `manager` and `employee` roles. Just six lines of code between them. Let's take a look.

<p class="block-header">/clients/templates/authenticated/employees.html</p>

```markup
<template name="employees">
  <h3>Employees</h3>
</template>
```

<p class="block-header">/clients/templates/authenticated/managers.html</p>

```markup
<template name="managers">
  <h3>Managers</h3>
</template>
```

Pretty simple, yeah? Here, we've simply defined two templates that will act as placeholders later. We won't fill these in, but we will use them to verify that we've correctly routed our users based on their permissions. Underwhelming for now, so just keep these in the back of your mind. Next is the big one: `users`. We've got a lot to work to do here, so let's get to it.

#### The `users` template
Our `users` template will support two primary actions: showing a list of the current users in our application and showing a list of invitations that we've sent out to new users (that haven't been accepted yet). Let's start by getting our list of _current_ users working.

<p class="block-header">/client/templates/authenticated/users.html</p>

```markup
<template name="users">
  {{#if isInRole 'admin'}}
    {{> sendInvitationModal}}

    <h4 class="page-header">Users</h4>
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>Email Address</th>
          <th class="text-center">Role</th>
        </tr>
      </thead>
      <tbody>
        {{#each users}}
          <tr>
            <td class="text-left text-middle">{{#if isCurrentUser _id}}<label class="label label-success">You!</label>{{/if}} {{emails.[0].address}}</td>
            <td>
              <select {{disableIfAdmin _id}} name="userRole" class="form-control">
                <option selected="{{selected roles.[0] 'admin'}}" value="admin">Admin</option>
                <option selected="{{selected roles.[0] 'manager'}}" value="manager">Manager</option>
                <option selected="{{selected roles.[0] 'employee'}}" value="employee">Employee</option>
              </select>
            </td>
          </tr>
        {{/each}}
      </tbody>
    </table>
    [...]
  {{/if}}
</template>
```

A few things to call attention to here. First, you will notice that all of the content in our template is wrapped in an `{{#if isInRole 'admin'}}` block. What the heck is this? A safeguard. As a convenience, the `roles` package gives us a template helper `isInRole` to check whether or not the current user is in the roles we specify. If they _are_, whatever code the `{{#if}}` block is wrapping will be revealed. If not, it's hidden. Neat! The reason we add this here and call it a safeguard has to do with Flow Router.

As we'll learn later, the way that it handles routing can be unpredictable at times. While we've set up a solid way to handle routing users based on their roles, in the event that our routing fails (don't panic, we'll explain why and how in a bit), this prevents unwanted users from accessing our admin-only content. For now, just know that it's here as a guard against worst case scenarios.

Next, we set up a table for displaying our users list with two columns: "Email Address" and "Role." The first column will display the email address of the user currently being looped over by the `{{#each users}}` block. The second column will display a select box that will allow us to change the role of each user in the list. To get this working, let's wire up a publication on the server so we can get the data we need.

<p class="block-header">/server/publications/users.js</p>

```javascript
Meteor.publish( 'users', function() {
  return [
    Meteor.users.find( {}, { fields: { "emails.address": 1, "roles": 1 } } ),
    Invitations.find( {}, { fields: { "email": 1, "role": 1, "date": 1 } } )
  ];
});
```

We're keeping this pretty simple. Here, we define a publication called `users` to denote that this publication is meant for subscription in our `users` template. Inside, we rely on Meteor's ability to return multiple cursors from a publication using an array. Here, we define two cursors: one on our `Meteor.users` collection and another on `Invitations`. The first goal here is to get back all of the users in our application with just their `emails` and `roles` fields intact. 

Note, because we intend to subscribe to this publication from our `users` template, this is safe because we _do_ want administrators in our application to have access to all users. We need to be careful, then, to _not_ subscribe to this publication when a user hasn't been properly authenticated. Just after this, we call to find all of the `Invitations` in our application, grabbing only the `email`, `role`, and `date` fields. Once this in place, we'll be able to subscribe to all of the data we need for our users template. In fact, let's get that squared away now!

<p class="block-header">/client/templates/authenticated/users.js</p>

```javascript
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
  [...]
});

[...]
```

In the logic for our `users` template, we first subscribe to the `users` publication we just defined in our `onCreated` callback. Next, we wire up a helper to return the list of users in our application by calling `Meteor.users.find();`. Why aren't we passing a `fields` filter here? Because we've already filtered our data at the publication-level, when we call `Meteor.users.find()` from the client we can be sure that all of the records we have access to are already filtered! Pretty neat. The rest is simple, here. If we have users, return them.

Back in our template, we should be able to see the administrator and test users we set up earlier.

<figure>
  <img src="https://tmc-post-content.s3.amazonaws.com/Screen-Shot-2015-10-06-23-32-54.png" alt="Our user's list.">
  <figcaption>Our user's list.</figcaption>
</figure>

Neat! Keep in mind, because our user's are being randomly generated, if you're following along you may notice that your users—aside from `admin@admin.com`—are different. This is expected! The point is that we can see them and that their roles are marked as `Employee` in the dropdown. Wait, how is this just...working? Ah, ha! Real quick, let's look at our `users` template again, paying attention to the output in the loop.

<p class="block-header">/client/templates/authenticated/users.html</p>

```markup
<template name="users">
  {{#if isInRole 'admin'}}
    {{> sendInvitationModal}}

    <h4 class="page-header">Users</h4>
    <table class="table table-bordered">
      <thead>
        <tr>
          <th>Email Address</th>
          <th class="text-center">Role</th>
        </tr>
      </thead>
      <tbody>
        {{#each users}}
          <tr>
            <td class="text-left text-middle">{{#if isCurrentUser _id}}<label class="label label-success">You!</label>{{/if}} {{emails.[0].address}}</td>
            <td>
              <select {{disableIfAdmin _id}} name="userRole" class="form-control">
                <option selected="{{selected roles.[0] 'admin'}}" value="admin">Admin</option>
                <option selected="{{selected roles.[0] 'manager'}}" value="manager">Manager</option>
                <option selected="{{selected roles.[0] 'employee'}}" value="employee">Employee</option>
              </select>
            </td>
          </tr>
        {{/each}}
      </tbody>
    </table>
    [...]
  {{/if}}
</template>
```

Okay! Inside, we've defined three helpers: `isCurrentUser`, `disableIfAdmin`, and `selected`. Let's hop over to our template helpers file and spit these out and then step through their functionality.

<p class="block-header">/client/helpers/template.js</p>

```javascript
Template.registerHelper( 'isCurrentUser', ( currentUser ) => {
  return currentUser === Meteor.userId() ? true : false;
});

Template.registerHelper( 'disableIfAdmin', ( userId ) => {
  if ( Meteor.userId() === userId ) {
    return Roles.userIsInRole( userId, 'admin' ) ? "disabled" : "";
  }
});

Template.registerHelper( 'selected', ( v1, v2 ) => {
  return v1 === v2 ? true : false;
});
```

Not much to them. The first, `isCurrentUser` simply checks to see if the ID passed to the helper as `currentUser` is equal to the ID of the currently logged in user. If it is, then the helper returns `true` revealing a label next to the user in the list that reads `You!` denoting the current user. This isn't necessary, but it's a nice UX touch for our users.

Next up, we have `disableIfAdmin`. This does a similar check to `isCurrentuser` first, seeing if the user ID passed is equal to the currently logged in user's ID. If it is, we perform a check using the `userIsInRole` method we get from the `roles` package to see if the `userId` passed is in the `admin` category. If they _are_—meaning the current user is an administrator—we output `disabled` as an attribute on the `<select></select>` input where we change the user's role. Why? This is just a safety precaution so that administrators don't accidently lock themselves out of the application. Nice! 

Finally, our `selected` helper simply checks to see if the two values passed are equal. If they are, we return `true` or `false` accordingly. Notice that in step with this, back in our template we have this value being returned inside of the `selected="{{selected ...}}"` attribute on each of the `<option></option>` elements in our select box. What does this accomplish? When looping our list, this allows us to mark the current user's role as selected. So, if user #1 is an admin, the "Admin" option is selected and if user #2 is a manager, the "Manager" option is selected and so on. Making sense?

Awesome! With this in place, we have a functioning list of users. Next, let's get this select box actually wired up so it changes the user's role when we change it!

#### Changing the user's role
This is pretty simple. What we want to do is update a user's role when we change the select box value next to their email address. Back in the logic for our `users` template, we've got a little event handler set up.

<p class="block-header">/client/templates/authenticated/users.js</p>

```javascript
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
  [...]
});
```

Nothing too crazy. First, we define our event to be called whenever the `change` event fires on the `[name="userRole"]` element (our `<select></select>`). Inside, we grab the value of the current selected option in the `<select></select>`. From there, we make a quick call to a method we've defined on the server, `setRoleOnUser`, passing `this._id`—the `_id` of the current element in the list, or, the user we're making the change to—and the `role` we grabbed from the `<select></select>`. With this, up to the server we go!

<p class="block-header">/path</p>

```javascript
Meteor.methods({
  setRoleOnUser( options ) {
    check( options, {
      user: String,
      role: String
    });

    try {
      Roles.setUserRoles( options.user, [ options.role ] );
    } catch( exception ) {
      return exception;
    }
  }
});
```
Super easy! Passing our arguments object over as `options`, we do a quick [`check()`](http://themeteorchef.com/snippets/using-the-check-package/) to make sure the data we're getting from the client is what we expect. Next, we simply call `Roles.setUserRoles` to set the selected role on the user that we passed over from the client. Boom! With this, our user is updated to the new role. To make sure, pop back over to the `users` template, change a user's role and then give the page a refesh. If all is well, the change should stick!

<figure>
  <img src="https://tmc-post-content.s3.amazonaws.com/Screen-Recording-2015-10-07-00-03-35.gif" alt="Changing the user's role.">
  <figcaption>Changing the user's role.</figcaption>
</figure>

Great. We're making some good progress. Next, let's focus on getting invitations sent and automating user sign ups. This will get us in the home stretch. From there, it's just a matter of getting our authentication in place for our routes.

### Sending invitations
Time for some fun stuff! First, let's update the logic in our `users` template a bit. Because we're displaying our open invitations list here, it makes sense to add in the functionality will need later here. 

<p class="block-header">/client/templates/authenticated/users.js</p>

```javascript
[...]

Template.users.helpers({
  [...]
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
  [...]
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
```

First, we add two helpers for our template. The first, `hasInvitations` helps us to check if our `Invitations` collection we published earlier is empty. If it is, this allows us to display a warning to the user that there are no open invitations. You may be wondering "why not just pass an `{{else}}` to the `{{#each invitations}}` loop?" Good question! This has to do with the table markup. By using this structure instead, we can cleanly display the alert message without the need for mucking with CSS. Neat and tidy!

Next, we have our actual loop of `Invitations`. This is what you'd expect. It simply loops over the documents returned for the `Invitations` collection, displaying them on the template. The one that may be weird here is down in the `events` map. Notice that we've added a call to `revokeInvitation` on the server when we click `.revoke-invite` in our interface. We're going to skip ahead a bit here to get this in place now. Here, we're making it possible to withdraw an invite later. This is handy for those times where we misspell a name, or one of our teammates gets a little too rowdy at the Annual Holiday Party and gets in a fist fight with the vending machines. Down on the client we simply pass the `_id` of the currently looped item in the list and up on the server...

<p class="block-header">/both/methods/remove/invitations.js</p>

```javascript
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
```

This is about as simple as it gets! We simply take the passed `_id`, check its type and then pluck it from the `Invitations` collection. Now, if a user were to click the link in the email we'll send in a bit, it would let them know that this token has expired. Perfect. Okay, back to the client so we can wire up the actual sending of our invitation.

<p class="block-header">/client/templates/authenticated/send-invitation-modal.html</p>

```markup
<template name="sendInvitationModal">
  <div class="modal fade" id="send-invitation-modal" tabindex="-1" role="dialog" aria-labelledby="send-invitation-modal" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
          <h4 class="modal-title" id="send-invitation">Send Invitation</h4>
        </div>
        <form id="send-invite-form">
          <div class="modal-body">
            <div class="form-group">
              <label for="emailAddress">Email Address</label>
              <input type="email" class="form-control" name="emailAddress">
            </div>
            <div>
              <label for="roles">User Role</label>
              <select name="roles" class="form-control">
                <option value="">Select a role...</option>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-default" data-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-success">Send Invitation</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
```

Here, we have the modal window that we reveal when clicking the green `Send Invitation` button that's displayed at the top right-hand corner of our "Invitations" list. Here, we simply collect two pieces of information: an email address and the role we wish to apply to our new user. The goal here is to simplify new signups. Instead of requiring users to fill out a bunch of information, we can simply send them an email with a unqiue token that already knows who they are and what they need. They simply fill out a password and click "Create Account." Let's look at the wiring for this and how our users finally get their email.

#### Wiring up invitations
The first step we need to take is handling the submission of this modal. Over in our modal's logic file:

<p class="block-header">/client/templates/authenticated/send-invitation-modal.js</p>

```javascript
Template.sendInvitationModal.events({
  'submit form' ( event, template ) {
    event.preventDefault();

    let email = template.find( "[name='emailAddress']" ).value,
        role  = template.find( "[name='roles'] option:selected" ).value;

    if ( email && role !== "" ) {
      Meteor.call( "sendInvitation", {
        email: email,
        role: role
      }, ( error, response ) => {
        if ( error ) {
          Bert.alert( error.reason, "warning" );
        } else {
          $( "#send-invitation-modal" ).modal( 'hide' );
          $( '.modal-backdrop' ).hide();
          Bert.alert( "Invitation sent!", "success" );
        }
      });
    } else {
      Bert.alert( "Please set an email and at least one user type!", "warning" );
    }
  }
});
```

A single event handler! When the form inside of our modal is submitted, we grab the email address to send our invite to along with the role we've selected. Next, we do some quick and dirty validation to alert the user if they haven't sent either the `emailAddress` or `roles` value. If they _have_ set both, we call to the `sendInvitation` method on the server. Strap in, this is where it gets a bit wild!

<p class="block-header">/both/methods/insert/invitations.js</p>

```javascript
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
```

This is a two-parter. First, we `check()` our data from the client and then we call a module we've defined on the server `sendInvitation`. Inside of our call, we pass the `email` and `role` value from the client, set a timestamp using the [ISO 8601](https://en.wikipedia.org/wiki/ISO_8601) standard, and call to `Random.hexString()`. What's that last part? Here, we're relying on the `random` package we installed at the beginning of the recipe to give us a compeltely random, 16 character hexadecimal string. Notice that we're assigning this to a field `token`. This will serve as the unique identifier for our user's invitation. 

Next, let's take a look at how this module is working under the hood.

<p class="block-header">/server/modules/send-invitation.js</p>

```javascript
let invitation = ( options ) => {
  _insertInvitation( options );
  var email = _prepareEmail( options.token );
  _sendInvitation( options.email, email );
};

let _insertInvitation = ( invite ) => {
  Invitations.insert( invite );
};

let _prepareEmail = ( token ) => {
  let domain = Meteor.settings.private.domain;
  let url    = `http://${ domain }/invite/${ token }`;

  SSR.compileTemplate( 'invitation', Assets.getText( 'email/templates/invitation.html' ) );
  let html = SSR.render( 'invitation', { url: url } );

  return html;
};

let _sendInvitation = ( email, content ) => {
  Email.send({
    to: email,
    from: "Jan Bananasmith <jan@banana.co>",
    subject: "Invitation to Banana Co.",
    html: content
  });
};

Modules.server.sendInvitation = invitation;
```

A handful of steps, but nothing too scary. First, again, we're relying on the [module pattern](http://themeteorchef.com/snippets/using-the-module-pattern-with-meteor) to make our multi-step process of creating and sending an invitation a little easier to read. First, we take the options we passed to our `Modules.server.sendInvitation` call and send them straight to the `Invitations` collection. Here, we're creating the actual invitation—or document in the `Invitations` collection—that we'll send to the user. 

Next, we call to a function `_prepareEmail` which we use to do two three things:

1. Grab the `domain` value from our [`settings-<environment>.js`](http://themeteorchef.com/snippets/making-use-of-settings-json/) file.
2. Assign that domain and the token we created to a new variable `url` which represents the URL we'll send to our users.
3. Compiles an HTML templtae using the [meteorhacks:ssr](https://github.com/meteorhacks/meteor-ssr) package (included in Base), returning an HTML string.

Once we have this complete, we make a call to `_sendInvitation` which takes our new user's email and the HTML we just compiled and shoots it off into the cosmos [using the email package](http://themeteorchef.com/snippets/using-the-email-package/) we installed earlier. At this point, our user should get an email that looks something like the following after a few minutes:

<figure>
  <img src="https://tmc-post-content.s3.amazonaws.com/Screen-Shot-2015-10-07-00-39-16.png" alt="Oh boy do I want to go to Bananapolis.">
  <figcaption>Oh boy, do I want to go to Bananapolis.</figcaption>
</figure>

<div class="note">
  <h3>Don't forget your MAIL_URL <i class="fa fa-warning"></i></h3>
  <p>We haven't covered it here, but you'll want to make sure to <a href="http://themeteorchef.com/snippets/using-the-email-package/#tmc-configuration">set up your MAIL_URL</a> environment variable to ensure Meteor actually sends your email.</p>
</div>

Awesome. Sweet. Killer. Rad. Now that we've got our email out in the wild, let's wire up the template where our users actually _accept_ invitations.

### Accepting invitations
Back on the client, we've already got a route set up that we're sending our users to at `http://localhost:3000/invite/:token`. Let's look at the companion template for this route real quick to see how our invitees will set up their accounts.

<p class="block-header">/path</p>

```markup
<template name="invite">
  <div class="row">
    {{#with invitation}}
    <div class="col-xs-12 col-sm-6 col-md-4">
      <h3 class="page-header">Accept Invitation</h3>
      <form id="accept-invitation">
        <div class="form-group">
          <label for="emailAddress">Email Address</label>
          <input disabled type="email" name="emailAddress" class="form-control" placeholder="Email Address" value="{{email}}">
        </div>
        <div class="form-group">
          <label for="password"><span class="pull-left">Password</span></label>
          <input type="password" name="password" class="form-control" placeholder="Password">
        </div>
        <div class="form-group">
          <input type="submit" class="btn btn-success" value="Create Account">
        </div>
      </form>
    </div>
    {{else}}
      <div class="col-xs-12">
        <p class="alert alert-warning">Sorry, doesn't look like this invite is valid cowpoke.</p>
      </div>
    {{/with}}
  </div>
</template>
```

Just two fields here, one of which is disabled! First, we wrap our form in a call to `{{#with invitation}}` which will display our form if our `invitation` helper—we'll set this up soon—returns an invitation. If it doesn't we simply display a friendly message to our user that this invitation isn't valid. If we save this template and then visit our invite route with a random token like `http://localhost:3000/invite/1234`, we should see this alert message displayed. This means that we couldn't find the matching invite in the database.

Let's wire up this template to see how it should _actually_ behave.

<p class="block-header">/client/templates/public/invite.js</p>

```javascript
Template.invite.onCreated( () => {
  Template.instance().subscribe( 'invite', FlowRouter.current().params.token );
});

Template.invite.helpers({
  invitation: function() {
    var invite = Invitations.findOne();

    if ( invite ) {
      return invite;
    }
  }
});

Template.invite.events({
  'submit form': function( event, template ) {
    event.preventDefault();

    let password = template.find( '[name="password"]' ).value;

    let user = {
      email: template.find( '[name="emailAddress"]' ).value,
      password: Accounts._hashPassword( password ),
      token: FlowRouter.current().params.token
    };

    Meteor.call( 'acceptInvitation', user, function( error, response ) {
      if ( error ) {
        Bert.alert( error.reason, 'warning' );
      } else {
        Meteor.loginWithPassword( user.email, password );
      }
    });
  }
});
```

First, we subscribe to a new publication `invite`, passing the current value assigned to the `:token` parameter in our URL. To be clear, if our URL is `http://localhost:3000/invite/bananas`, this value would be `bananas`. Making some (ridiculous) sense? Real quick, let's check out that publication.

<p class="block-header">/server/publications/invite.js</p>

```javascript
Meteor.publish( 'invite', function( token ) {
  check( token, String );
  return Invitations.find( { "token": token } );
});
```

A little _too_ easy. Here, we simply `check()` our argument and then do a `find()` on the `Invitations` collection, passing our `token` as the query. Easy! If we find a document, all is well. If we don't, we get that alert back on the client. Back to our `invite` template's logic.

<p class="block-header">/client/templates/public/invite.js</p>

```javascript
[...]

Template.invite.helpers({
  invitation: function() {
    var invite = Invitations.findOne();

    if ( invite ) {
      return invite;
    }
  }
});

Template.invite.events({
  'submit form': function( event, template ) {
    event.preventDefault();

    let password = template.find( '[name="password"]' ).value;

    let user = {
      email: template.find( '[name="emailAddress"]' ).value,
      password: Accounts._hashPassword( password ),
      token: FlowRouter.current().params.token
    };

    Meteor.call( 'acceptInvitation', user, function( error, response ) {
      if ( error ) {
        Bert.alert( error.reason, 'warning' );
      } else {
        Meteor.loginWithPassword( user.email, password );
      }
    });
  }
});
```

With our subscription in place, we wire up a helper `invitation` to a `findOne()` call. This is what we're passing to our `{{#with}}` block in our template. If we find an invite, this will return it to the template. Last but not least, the big show! When our form is submitted, we grab the user's `email`, `password`, and `token`, and pass it up to the server via the `acceptInvitation` method. A few notes here. First, notice that for our `password` parameter, we're wrapping the value we get from our password field in a call to `Accounts._hashPassword()`. What's this? This is a private function in Meteor that we can use to hash the password on the client before sending it to the server. 

I was tipped of about this by a fellow reader [Mz103](http://themeteorchef.com/recipes/adding-a-beta-invitation-system-to-your-meteor-application/#comment-2264039525). The basic idea, here, is that because we're sending our user's credentials over the wire to the server, it's smart to hash their password first so it's not going over the connection as plain text. A neat security trick!

Additionally, notice that in the success state of our `acceptInvitation` call's callback, we log the user in with the email and password value passed to us. If all goes well up on the server, our user will be logged into their spiffy new account. Let's jump up to the server now to see how this ties together.

<p class="block-header">/both/methods/insert/users.js</p>

```javascript
Meteor.methods({
  acceptInvitation( user ) {
    check( user, {
      email: String,
      password: Object,
      token: String
    });

    try {
      var userId = Modules.server.acceptInvitation( user );
      return userId;
    } catch( exception ) {
      return exception;
    }
  }
});
```

Following a common thread, here. We do a wee bit of `check()`ing and then call to another module on the server side, `acceptInvitation`, passing our `user` document along.

<p class="block-header">/server/modules/accept-invitation.js</p>

```javascript
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
```

[Extract till you drop](https://sites.google.com/site/unclebobconsultingllc/one-thing-extract-till-you-drop)! Here, we have a bunch of tiny little functions that act as a trail of breadcrumbs to our final desitation: a new user. First, we pluck the invitation out of the database using the token we received from the client. 

Next, we create a new user in the database, passing the `email` and hashed `password` we received from the client. Finally, we update our new user with the role that we assigned to them in the dashboard. Last but not least for tidyness sake, we make their invitation go bye-bye! It's of no use to us at this point.

And...that's it! At this point we technically have a working invitation and sign up flow and a way to manage our users. But wait! Don't get too excited. Remember that we've got a little bit of work to do in our router to make sure users are getting sent to the right places. Put your hard hat back on.

### Adding roles to routes
Oof. This is the tough part. Your pal, TMC, got his butt kicked trying to figure this out. Fair warning: it's not perfect. The reality is that Flow Router is a pretty big paradigm shift in comparison to Iron Router. It's a great tool, but boy does it take some getting used to. Let's look at what we came up with for handling role checking in the routes to control access to different routes based on a user's role. First up: our public routes.

<p class="block-header">/both/routes/public.js</p>

```javascript
const publicRedirect = ( context, redirect ) => {
  if ( Meteor.userId() ) {
    Modules.both.redirectUser( { redirect: redirect } );
  }
};

[...]
```

At the top of our `public.js` file, we find the `publicRedirect` function we passed to our `publicRoutes` group's `triggersEnter` property earlier. Here, what we're trying to say is "when we visit one of these public routes, if there is a logged in user, call `Modules.both.redirectUser` passing the `redirect` instance from Flow Router." Huh? In laymen's (Ryan) terms: if the user is logged in, we want to redirect them _away_ from these public routes. Yeah, much better. Let's take a peek at that module.

<p class="block-header">/both/modules/redirect-users.js</p>

```javascript
let route = ( options ) => {
  return options && options.redirect ? _sendUserToDefault( options.redirect ) : _sendUserToDefault();
};

let _sendUserToDefault = ( redirect ) => {
  let roles = _getCurrentUserRoles();

  if ( roles[0] === 'admin' )    {
    _redirectUser( 'users', redirect );
  }

  if ( roles[0] === 'manager' )  {
    _redirectUser( 'managers', redirect );
  }

  if ( roles[0] === 'employee' ) {
    _redirectUser( 'employees', redirect );
  }
};

let _getCurrentUserRoles = () => {
  return Roles.getRolesForUser( Meteor.userId() );
};

let _redirectUser = ( path, redirect ) => {
  if ( redirect ) {
    redirect( path );
  } else {
    FlowRouter.go( FlowRouter.path( path ) );
  }
};

Modules.both.redirectUser = route;
```

Well, it's not _too_ bad. It's not, but it's a bit confusing at first glance. What's happening in here is a bit voodoo. First, we check if our module `Modules.both.redirectUser` is called with any options, and specifically, a `redirect` parameter. If it is, we make a call to our `_sendUserToDefault()` function, passing along the `redirect` value. Inside of `_sendUserToDefault()` we make a call to `Roles.getRolesForUser()` passing the current user's ID. Once we have this value, we try to determine—based on the user's role—where we should send them to. 

The idea here is that if we hit a public route as a logged in user, we want to redirect the user to their "default" view. So, if we're an admin, we want to be redirected to the `users` list. If we're an employee, we want to go to the `employees` page, and so on. To handle the actual routing, inside of `_redirectUser`, we make a decision on whether to use the `redirect()` method (if it was passed), or, to use the `FlowRouter.go()` method, passing the path we passed to each. Holy cow. This `redirect()` vs `FlowRouter.go()` thing is the result of pure experimentation. 

The logic here—as I understand it—is that routes in Flow Router are idempotent, meaning, they run once and _only_ once. As a result, if we call `FlowRouter.go()` for a path once and then try to call it again, it won't work. Conversely, if we're within a `triggersEnter` function and call `redirect( <path> )`, our user is redirected as expected. My thoughts here are that this is a bit much for what it accomplishes, but it _does_ work. 

<div class="note">
  <h3>Help me understand this? <i class="fa fa-warning"></i></h3>
  <p>If you're a bit more versed in the ways of the Flow Router, please educate me in the comments so I can get this updated with the clearest solution. Thanks in advance!</p>
</div>

Okay. Two more steps. Both use this same module so it will go quick. Over to our `authenticated` routes real quick.

<p class="block-header">/both/routes/authenticated.js</p>

```javascript
const blockUnauthorizedAdmin = ( context, redirect ) => {
  if ( Meteor.userId() && !Roles.userIsInRole( Meteor.userId(), 'admin' ) ) {
    Modules.both.redirectUser( { redirect: redirect } );
  }
};

const blockUnauthorizedManager = ( context, redirect ) => {
  if ( Meteor.userId() && !Roles.userIsInRole( Meteor.userId(), [ 'admin', 'manager' ] ) ) {
    Modules.both.redirectUser( { redirect: redirect } );
  }
};

const authenticatedRoutes = FlowRouter.group({
  name: 'authenticated',
  triggersEnter: [ authenticatedRedirect ]
});

authenticatedRoutes.route( '/users', {
  name: 'users',
  triggersEnter: [ blockUnauthorizedAdmin ],
  action() {
    BlazeLayout.render( 'default', { yield: 'users' } );
  }
});

authenticatedRoutes.route( '/managers', {
  name: 'managers',
  triggersEnter: [ blockUnauthorizedManager ],
  action() {
    BlazeLayout.render( 'default', { yield: 'managers' } );
  }
});

[...]
```

To things here. We're defining two functions that are called independently: `blockUnauthorizedAdmin` and `blockUnauthorizedManager`. We call the first when we're visting the `/users` route and the second when we're visting the `/managers` route. The idea here is that if a logged in user visits `/users`, we want to ensure that they're an admin user. If they're not, we want to redirect them to their "default" view (i.e. employees are redirected to the `employees` template). 

Here, notice that in each of our functions, we make a call to `Roles.userIsInRole`, passing the "allowed" roles for that route. When we're on `/users`, we want our user to be an `admin` only. When we're on `/managers`, you can be an `admin` or `manager`. Notice that `employees` are open to _all_ logged in users as this is the lowest role level. Almost done! One last thing to point out.

<p class="block-header">/both/routes/configure.js</p>

```javascript
[...]

Accounts.onLogin( () => {
  let currentRoute = FlowRouter.current();
  if ( currentRoute && currentRoute.route.group.name === 'public' ) {
    Modules.both.redirectUser();
  }
});

[...]
```

To handle redirects of users when they first login (e.g. when creating an account when they accept their invitation), we watch for the `Accounts.onLogin` method to be called. Inside, if we find that there is a current route and the current route group's name is `public`, we call our `redirectUser` module to punt the user to their default view.

Phew! Hopefully this routing part didn't kill your joy. We're done! With this in place, we now have a complete user invitation system with an admin panel. Tip your cowboy hat to the west, spit your chew, and shout a yeehaw at the blazing sun, cowpoke.

### Wrap Up & Summary
In this recipe, we learned how to create a user admin dashboard. We learned how to create an invitation system that allowed us to invite users via email using unique tokens, how to manage those users after they've joined, and how to route users around our application based on their roles.